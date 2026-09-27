import { createStaticResourceResolver } from "../../packages/presentation/src/index.js";
import { courtroomDemoResources } from "./generated.js";

export const courtroomDemoResolver = createStaticResourceResolver([courtroomDemoResources]);
