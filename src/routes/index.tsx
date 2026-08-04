import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeading } from "@/components/BrandHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { amaTitle } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${amaTitle} — Ask anything, anonymously` },
      {
        name: "description",
        content:
          "Join a live classroom session, submit questions anonymously, and upvote the ones you want answered.",
      },
      { property: "og:title", content: amaTitle },
      {
        property: "og:description",
        content: "Join a live classroom session and ask anything, anonymously.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Live classroom Q&amp;A
        </p>
        <BrandHeading />
        <p className="text-sm text-muted-foreground">
          Ask anything, anonymously. Upvote the questions you most want answered.
        </p>
      </header>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = code.trim().toUpperCase();
          if (clean.length >= 4) navigate({ to: "/j/$code", params: { code: clean } });
        }}
      >
        <label className="text-sm font-medium" htmlFor="code">
          Session code
        </label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          autoCapitalize="characters"
          className="h-14 text-center text-2xl font-display tracking-[0.3em]"
          maxLength={8}
        />
        <Button type="submit" className="h-12 w-full text-base">
          Join session
        </Button>
      </form>

      <footer className="border-t border-border pt-6 text-sm">
        {signedIn ? (
          <Link to="/dashboard" className="font-medium text-primary hover:underline">
            Go to instructor dashboard →
          </Link>
        ) : (
          <Link to="/auth" className="font-medium text-primary hover:underline">
            Instructor sign in →
          </Link>
        )}
      </footer>
    </main>
  );
}
