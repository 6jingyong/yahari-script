#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import pathlib
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

FOLDER_MIME = "application/vnd.google-apps.folder"
GOOGLE_MIME_PREFIX = "application/vnd.google-apps."


def safe_name(name: str) -> str:
    if not name or name in {".", ".."} or "/" in name or "\\" in name or "\x00" in name:
        raise ValueError(f"Unsafe Google Drive item name: {name!r}")
    return name


def list_children(service, parent_id: str):
    page_token = None
    while True:
        response = (
            service.files()
            .list(
                q=f"'{parent_id}' in parents and trashed = false",
                pageSize=1000,
                pageToken=page_token,
                fields="nextPageToken,files(id,name,mimeType,md5Checksum,size)",
                orderBy="name_natural",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        for item in response.get("files", []):
            yield item
        page_token = response.get("nextPageToken")
        if not page_token:
            break


def download_file(service, item: dict, target: pathlib.Path) -> None:
    mime_type = item["mimeType"]
    if mime_type.startswith(GOOGLE_MIME_PREFIX):
        raise RuntimeError(
            f"Unsupported Google-native file at {target}. "
            "Keep the project tree as normal uploaded files/folders, not Docs/Sheets/shortcuts."
        )

    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name + ".part")
    request = service.files().get_media(fileId=item["id"], supportsAllDrives=True)

    with temp.open("wb") as fh:
        downloader = MediaIoBaseDownload(fh, request, chunksize=8 * 1024 * 1024)
        done = False
        while not done:
            _, done = downloader.next_chunk(num_retries=5)

    expected_md5 = item.get("md5Checksum")
    if expected_md5:
        digest = hashlib.md5()
        with temp.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                digest.update(chunk)
        actual_md5 = digest.hexdigest()
        if actual_md5 != expected_md5:
            temp.unlink(missing_ok=True)
            raise RuntimeError(
                f"Checksum mismatch for {target}: expected {expected_md5}, got {actual_md5}"
            )

    temp.replace(target)


def mirror_folder(service, folder_id: str, destination: pathlib.Path) -> int:
    children = list(list_children(service, folder_id))
    names = [safe_name(item["name"]) for item in children]
    if len(names) != len(set(names)):
        duplicates = sorted({name for name in names if names.count(name) > 1})
        raise RuntimeError(
            "Google Drive allows duplicate names in one folder, but a filesystem mirror does not. "
            f"Resolve duplicates first: {duplicates}"
        )

    file_count = 0
    for item in children:
        target = destination / safe_name(item["name"])
        if item["mimeType"] == FOLDER_MIME:
            target.mkdir(parents=True, exist_ok=True)
            file_count += mirror_folder(service, item["id"], target)
        else:
            download_file(service, item, target)
            file_count += 1
    return file_count


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Mirror a Google Drive folder into a local staging directory."
    )
    parser.add_argument("--folder-id", required=True)
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()

    raw_credentials = os.environ.get("GDRIVE_SERVICE_ACCOUNT_JSON")
    if not raw_credentials:
        print("GDRIVE_SERVICE_ACCOUNT_JSON is not set.", file=sys.stderr)
        return 2

    try:
        info = json.loads(raw_credentials)
    except json.JSONDecodeError as exc:
        print(f"GDRIVE_SERVICE_ACCOUNT_JSON is not valid JSON: {exc}", file=sys.stderr)
        return 2

    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive.readonly"]
    )
    service = build("drive", "v3", credentials=credentials, cache_discovery=False)

    root = (
        service.files()
        .get(
            fileId=args.folder_id,
            fields="id,name,mimeType",
            supportsAllDrives=True,
        )
        .execute()
    )
    if root.get("mimeType") != FOLDER_MIME:
        print(f"Drive item {args.folder_id} is not a folder.", file=sys.stderr)
        return 2

    destination = pathlib.Path(args.destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)

    count = mirror_folder(service, args.folder_id, destination)
    print(f"Mirrored {count} files from Drive folder {root.get('name', args.folder_id)!r}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
