import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rules | HFW Fantasy Auction",
  description: "Bidding, squad, scoring, transfers, and misc rules for HFW Fantasy Auction.",
};

export default function RulesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm font-medium text-sky-800 underline-offset-2 hover:underline"
        >
          ← Home
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-sky-800 hover:underline"
        >
          Active Auctions
        </Link>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        HFW Fantasy Auction Rules
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
        The rules for bidding, scoring, transfers, and how the game works. Keep this page handy while
        you build your squad.
      </p>

      <nav
        aria-label="Rules sections"
        className="mt-8 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
      >
        <p className="font-medium text-slate-800">On this page</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sky-800">
          <li>
            <a href="#bidding-and-squad" className="underline-offset-2 hover:underline">
              Bidding and Squad Rules
            </a>
          </li>
          <li>
            <a href="#point-scoring" className="underline-offset-2 hover:underline">
              Point Scoring System Rules
            </a>
          </li>
          <li>
            <a href="#transfers-and-other" className="underline-offset-2 hover:underline">
              Transfers and other rules
            </a>
          </li>
          <li>
            <a href="#misc" className="underline-offset-2 hover:underline">
              Misc rules
            </a>
          </li>
          <li>
            <a href="#tips-for-beginners" className="underline-offset-2 hover:underline">
              Tips for beginners
            </a>
          </li>
        </ul>
      </nav>

      <div className="mt-10 space-y-12 text-sm leading-relaxed text-slate-700 sm:text-base">
        <section id="bidding-and-squad" className="scroll-mt-6">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Bidding and Squad Rules
          </h2>

          <RuleBlock title="Squad size">
            Your squad can have up to <strong>18 players</strong>. That includes players you already
            own and players where you are currently the highest bidder.
          </RuleBlock>

          <RuleBlock title="Goalkeepers">
            You may own <strong>only 1 goalkeeper</strong>. All goalkeepers from the same real-world
            club or nation are scored <strong>together as one unit</strong>. Owning that team&apos;s
            keeper means you get that unit&apos;s points for the gameweek.
          </RuleBlock>

          <RuleBlock title="Positions when building your squad">
            There is <strong>no required split</strong> of defenders, midfielders, or forwards when
            you buy players. Fill your 18 however you like (within the 1 GK limit). Positions{" "}
            <strong>do</strong> matter later, when the Best XI is built for scoring.
          </RuleBlock>

          <RuleBlock title="Minimum bid">
            Opening bids start at <strong>5m</strong>. Bids are whole numbers only.
          </RuleBlock>

          <RuleBlock title="Bid raises under 50m">
            If the current high bid is <strong>under 50m</strong>, any higher whole number is allowed
            (for example, 20 → 21 is fine).
          </RuleBlock>

          <RuleBlock title="Bid raises at 50m and above">
            Once the high bid is <strong>50m or more</strong>, every raise must be by at least{" "}
            <strong>+5m</strong> (for example, 50 → 55; 55 → 60).
          </RuleBlock>

          <RuleBlock title="The 24-hour rule">
            <p>
              Each valid bid starts (or restarts) a <strong>24-hour clock</strong> on that player. If
              nobody outbids you within those 24 hours, you win the player at your bid (unless a later
              auction hard deadline ends the lot sooner).
            </p>
            <p className="mt-3 font-medium text-slate-800">Example</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>Mon 3:00pm — you bid 25m on a player. Clock runs until Tue 3:00pm.</li>
              <li>Tue 1:00pm — someone bids 30m. Clock restarts until Wed 1:00pm.</li>
              <li>Wed 1:00pm — no further bids → they win at 30m.</li>
            </ul>
          </RuleBlock>

          <RuleBlock title="Self-raises">
            You may raise your own high bid. You cannot take a bid back.
          </RuleBlock>

          <RuleBlock title="Releases">
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>1 paid release per gameweek</strong> — you get half the purchase price back.
              </li>
              <li>
                Any further releases that gameweek are <strong>free</strong> (no money back).
              </li>
            </ul>
            <p className="mt-2">Released players return to the bidding pool.</p>
          </RuleBlock>

          <RuleBlock title="Best XI">
            Each gameweek, only your <strong>Best XI</strong> counts toward your score:{" "}
            <strong>1 goalkeeper + up to 10 outfielders</strong>. The rest of your squad is on the
            bench for that week&apos;s points.
          </RuleBlock>

          <RuleBlock title="Formations">
            <p>
              The system chooses the formation that maximises your points from this allowed list:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>3-5-2</li>
              <li>3-4-3</li>
              <li>4-5-1</li>
              <li>4-4-2</li>
              <li>4-3-3</li>
              <li>5-4-1</li>
              <li>5-3-2</li>
            </ul>
            <p className="mt-2">You do not pick the formation yourself.</p>
          </RuleBlock>

          <RuleBlock title="How a player’s position is decided (for Best XI)">
            A player can fill a Best XI slot if they are eligible for that line (defender,
            midfielder, or forward). Eligibility comes from:
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <strong>Listed position</strong> — the position on the master player list
                (Defender / Midfielder / Forward / Goalkeeper), and
              </li>
              <li>
                <strong>In-match FotMob role</strong> — how they actually lined up or were classified
                in that gameweek&apos;s matches.
              </li>
            </ul>
            <p className="mt-2">
              If they played in a role different from their listed position, they can count in either
              role. If there is no usable match role data, listed position only applies.
            </p>
          </RuleBlock>

          <RuleBlock title="No positional squad split, but Best XI needs the right lines">
            You can stockpile midfielders if you want — but Best XI still needs enough eligible
            players to fill a valid formation. Extra players who do not fit the chosen lines stay on
            the bench.
          </RuleBlock>
        </section>

        <section id="point-scoring" className="scroll-mt-6">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Point Scoring System Rules
          </h2>

          <RuleBlock title="How a gameweek score is built">
            Each gameweek, players earn points from their real matches. Your gameweek total comes from
            your Best XI only. A player&apos;s <strong>in-match position</strong> (how they lined up
            or were classified in that match) feeds into the scoring algorithm — including which line
            of the Best XI they can fill.
          </RuleBlock>

          <RuleBlock title="Stat points">
            <p>
              Most of a player&apos;s score comes from match statistics derived from{" "}
              <strong>FotMob</strong>.
            </p>
            <p className="mt-2">
              Examples of how big actions are valued: <strong>goals score 10 points</strong> and{" "}
              <strong>assists score 8 points</strong>. Other stats also count — tackles,
              interceptions, clearances, shots, passes, saves, and so on — plus some rarer “edge”
              actions when they appear in the data (for example a last-man tackle or a clearance off
              the line).
            </p>
            <p className="mt-2">
              Public ratings (FotMob score, WhoScored.com rating, and the like) are usually a good
              signal of how well someone played. Your fantasy points are not taken from those ratings
              — they are calculated from the underlying FotMob stats.
            </p>
          </RuleBlock>

          <RuleBlock title="Endowed points">
            <p>
              On top of raw stats, players get <strong>endowed points</strong> based on what happened
              while they were on the pitch:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-2">
              <li>
                <strong>Goalkeepers</strong> — team keeper unit: 18, then −6 per goal conceded by the
                team.
              </li>
              <li>
                <strong>Defenders</strong> — base 10 (or 5 if under 45 minutes), then −5 per goal
                conceded while they were on.
              </li>
              <li>
                <strong>Midfielders</strong> — base 5 (or 2.5 if under 45 minutes), then +2 per team
                goal scored and −2 per team goal conceded while they were on.
              </li>
              <li>
                <strong>Forwards</strong> — base 0 (even under 45 minutes), then +3 per team goal
                scored while they were on.
              </li>
            </ul>
            <p className="mt-3">
              Full weight tables for every other stat are not listed here. If you want a deeper
              walkthrough of the point system, write to us separately and we can share more detail.
            </p>
          </RuleBlock>
        </section>

        <section id="transfers-and-other" className="scroll-mt-6">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Transfers and other rules
          </h2>

          <RuleBlock title="What you can trade">
            <p>When the transfer window is open, you can deal with other managers using any mix of:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>player ↔ player</li>
              <li>player ↔ cash</li>
              <li>players + cash on either side</li>
            </ul>
            <p className="mt-2">
              Both sides must put something into the deal (a pure one-way cash gift is not allowed).
            </p>
          </RuleBlock>

          <RuleBlock title="How it works on the site">
            <ol className="list-inside list-decimal space-y-2">
              <li>
                Open your auction and go to <strong>Transfers</strong>.
              </li>
              <li>
                <strong>Propose</strong> — pick a manager, choose which of your owned players and/or
                cash you are offering.
              </li>
              <li>
                They <strong>respond</strong> — they choose which of their players and/or cash they
                are sending back.
              </li>
              <li>
                <strong>Both of you confirm</strong> the final deal (each confirms once).
              </li>
              <li>
                The deal then completes (or goes to admin review when required — see FFP below).
                Squads and budgets update when it executes.
              </li>
            </ol>
            <p className="mt-3">
              Until a deal is finished, cash involved can be held so it cannot also be spent on bids.
              You can only trade players you already own — not players where you are merely the
              current highest bidder. After the swap, both squads must still respect the usual limits
              (max 18 players, max 1 goalkeeper).
            </p>
            <p className="mt-2">
              The transfer window is opened and closed by the admin. When the auction hard deadline
              hits, open (unfinished) transfers are cancelled.
            </p>
          </RuleBlock>

          <RuleBlock title="Financial Fair Play (FFP)">
            Deals that are clearly unfair or not competitive in nature may be{" "}
            <strong>denied</strong> under Financial Fair Play, as judged by the admins. In those
            cases the transfer does not go through even if both managers agreed.
          </RuleBlock>
        </section>

        <section id="misc" className="scroll-mt-6">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Misc rules</h2>

          <RuleBlock title="Starting budget">
            Each manager starts with <strong>350m</strong>.
          </RuleBlock>

          <RuleBlock title="Kick-off budget boost">
            At kick-off, every manager receives a <strong>100m</strong> budget boost.
          </RuleBlock>

          <RuleBlock title="Real-world player moves">
            <ul className="list-inside list-disc space-y-2">
              <li>
                If a player is <strong>transferred out of the competition</strong> (leaves the
                relevant pool entirely), you get a <strong>full refund</strong> of what you paid.
              </li>
              <li>
                If a player is <strong>transferred within the competition</strong> (still in the same
                tournament / eligible pool), they <strong>stay in your team</strong> — no automatic
                refund or removal.
              </li>
            </ul>
          </RuleBlock>

          <RuleBlock title="Nation or club knocked out">
            If a real-world nation or club is knocked out of the tournament, owned players from that
            side leave your squad with a <strong>half-price refund</strong>. This is different from a
            player being transferred out of the competition (which is a full refund).
          </RuleBlock>

          <RuleBlock title="Squad lock">
            Only the squad you hold at the <strong>gameweek deadline</strong> scores that week. Later
            buys or releases do not rewrite a past gameweek.
          </RuleBlock>

          <RuleBlock title="Relegation / cut">
            Bottom managers may be made <strong>view-only</strong> and lose the right to bid or
            transfer (season-dependent).
          </RuleBlock>

          <RuleBlock title="No bid retractions">
            Once placed, a bid cannot be taken back. You can only be outbid or wait out the lot timer.
          </RuleBlock>

          <RuleBlock title="Outstanding bids vs transfers">
            Cash tied up in high bids reduces what you can put into a transfer until those lots settle
            or you are outbid.
          </RuleBlock>

          <RuleBlock title="Incomplete Best XI">
            Empty Best XI slots simply score 0. There is no auto-fill beyond your eligible squad.
          </RuleBlock>

          <RuleBlock title="Admin decisions">
            Disputes on deadlines, refunds, FFP, or data errors are settled by the admins and are
            final for that auction.
          </RuleBlock>
        </section>

        <section id="tips-for-beginners" className="scroll-mt-6">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Tips for beginners
          </h2>
          <p className="mt-3 text-slate-600">
            Not hard rules — just habits that help new managers avoid common traps.
          </p>

          <RuleBlock title="Fill the full 18">
            A common beginner mistake is spending almost the whole budget on 13–14 players and then
            struggling to fill the squad. Aim to complete an <strong>18-man squad</strong> — depth
            matters when injuries, rotations, and Best XI eligibility kick in.
          </RuleBlock>

          <RuleBlock title="Focus on starters">
            Prioritise players who start matches. Substitutes often will not rack up enough stats to
            score well — even if they score a goal after coming on, there usually is not enough time
            left to build a strong overall haul.
          </RuleBlock>

          <RuleBlock title="A sensible position mix">
            There is no forced squad split, but a useful starting guide is roughly{" "}
            <strong>6–7 defenders, 6–7 midfielders, and 3–4 forwards</strong>, plus your goalkeeper.
            That tends to give Best XI more options across formations.
          </RuleBlock>

          <RuleBlock title="Look beyond goalscorers">
            Do not chase goals alone. Players with high overall involvement — tackles, chances
            created, progressive play, defending, and general match influence — often score more
            consistently than pure finishers who blank more often.
          </RuleBlock>

          <RuleBlock title="Plan your bids">
            Try not to bid on bias or favourites. Plan ahead, and keep budget, squad needs, and fair
            valuations in mind before you raise.
          </RuleBlock>

          <RuleBlock title="Not under the influence">
            Do not bid under the influence. Clear heads make better auctions.
          </RuleBlock>
        </section>
      </div>

      <p className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        Questions about the finer points of scoring? Write to us separately.
      </p>
    </main>
  );
}

function RuleBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}
