import { createFileRoute } from "@tanstack/react-router";

import { BuddyChat } from "@/components/BuddyChat";

const title = "Campus Buddy — your friendly AI sidekick for student life";
const description =
  "Chat with Campus Buddy for study plans, deadline to-do lists, stress relief, quick meal ideas and a pep talk when you need one.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuddyChat,
});
