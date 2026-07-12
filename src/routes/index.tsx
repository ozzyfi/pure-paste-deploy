import { createFileRoute } from "@tanstack/react-router";
// @ts-expect-error - user-provided jsx file, imported as-is
import ToolAApp from "../toola-teknisyen-app.jsx";

export const Route = createFileRoute("/")({
  component: ToolAApp,
});
