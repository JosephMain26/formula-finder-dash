import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/balances")({
  beforeLoad: () => {
    throw redirect({ to: "/reports", search: { tab: "balances" } });
  },
});
