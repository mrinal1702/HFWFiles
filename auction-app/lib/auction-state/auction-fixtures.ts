/** Competition fixtures shown in-auction (modal). Keyed by auction id. */

export type AuctionFixture = {
  /** Display date, e.g. "Fri 21 Aug" */
  dateLabel: string;
  /** Kick-off UK time, e.g. "20:00" */
  kickoff: string;
  home: string;
  away: string;
};

export type AuctionMatchweek = {
  week: number;
  /** Short heading, e.g. "Matchweek 1" */
  label: string;
  fixtures: AuctionFixture[];
};

const PL_2627_MW1_TO_4: AuctionMatchweek[] = [
  {
    week: 1,
    label: "Matchweek 1",
    fixtures: [
      { dateLabel: "Fri 21 Aug", kickoff: "20:00", home: "Arsenal", away: "Coventry City" },
      { dateLabel: "Sat 22 Aug", kickoff: "12:30", home: "Hull City", away: "Manchester United" },
      { dateLabel: "Sat 22 Aug", kickoff: "15:00", home: "Everton", away: "Crystal Palace" },
      { dateLabel: "Sat 22 Aug", kickoff: "15:00", home: "Ipswich Town", away: "Sunderland" },
      { dateLabel: "Sat 22 Aug", kickoff: "15:00", home: "Nottingham Forest", away: "Leeds United" },
      { dateLabel: "Sat 22 Aug", kickoff: "17:30", home: "Brentford", away: "Tottenham Hotspur" },
      { dateLabel: "Sun 23 Aug", kickoff: "14:00", home: "Brighton & Hove Albion", away: "Aston Villa" },
      { dateLabel: "Sun 23 Aug", kickoff: "14:00", home: "Manchester City", away: "AFC Bournemouth" },
      { dateLabel: "Sun 23 Aug", kickoff: "16:30", home: "Newcastle United", away: "Liverpool" },
      { dateLabel: "Mon 24 Aug", kickoff: "20:00", home: "Fulham", away: "Chelsea" },
    ],
  },
  {
    week: 2,
    label: "Matchweek 2",
    fixtures: [
      { dateLabel: "Fri 28 Aug", kickoff: "20:00", home: "Crystal Palace", away: "Manchester City" },
      { dateLabel: "Sat 29 Aug", kickoff: "12:30", home: "Liverpool", away: "Nottingham Forest" },
      { dateLabel: "Sat 29 Aug", kickoff: "15:00", home: "AFC Bournemouth", away: "Everton" },
      { dateLabel: "Sat 29 Aug", kickoff: "15:00", home: "Coventry City", away: "Hull City" },
      { dateLabel: "Sat 29 Aug", kickoff: "17:30", home: "Tottenham Hotspur", away: "Newcastle United" },
      { dateLabel: "Sun 30 Aug", kickoff: "14:00", home: "Chelsea", away: "Brighton & Hove Albion" },
      { dateLabel: "Sun 30 Aug", kickoff: "14:00", home: "Leeds United", away: "Brentford" },
      { dateLabel: "Sun 30 Aug", kickoff: "14:00", home: "Sunderland", away: "Fulham" },
      { dateLabel: "Sun 30 Aug", kickoff: "16:30", home: "Manchester United", away: "Ipswich Town" },
      { dateLabel: "Mon 31 Aug", kickoff: "20:00", home: "Aston Villa", away: "Arsenal" },
    ],
  },
  {
    week: 3,
    label: "Matchweek 3",
    fixtures: [
      { dateLabel: "Fri 4 Sep", kickoff: "20:00", home: "Ipswich Town", away: "Liverpool" },
      { dateLabel: "Sat 5 Sep", kickoff: "12:30", home: "Newcastle United", away: "AFC Bournemouth" },
      { dateLabel: "Sat 5 Sep", kickoff: "15:00", home: "Brentford", away: "Sunderland" },
      { dateLabel: "Sat 5 Sep", kickoff: "15:00", home: "Brighton & Hove Albion", away: "Leeds United" },
      { dateLabel: "Sat 5 Sep", kickoff: "15:00", home: "Fulham", away: "Crystal Palace" },
      { dateLabel: "Sat 5 Sep", kickoff: "15:00", home: "Manchester City", away: "Coventry City" },
      { dateLabel: "Sat 5 Sep", kickoff: "15:00", home: "Nottingham Forest", away: "Tottenham Hotspur" },
      { dateLabel: "Sat 5 Sep", kickoff: "17:30", home: "Hull City", away: "Aston Villa" },
      { dateLabel: "Sun 6 Sep", kickoff: "14:00", home: "Everton", away: "Manchester United" },
      { dateLabel: "Sun 6 Sep", kickoff: "16:30", home: "Arsenal", away: "Chelsea" },
    ],
  },
  {
    week: 4,
    label: "Matchweek 4",
    fixtures: [
      { dateLabel: "Sat 12 Sep", kickoff: "15:00", home: "AFC Bournemouth", away: "Brentford" },
      { dateLabel: "Sat 12 Sep", kickoff: "15:00", home: "Aston Villa", away: "Nottingham Forest" },
      { dateLabel: "Sat 12 Sep", kickoff: "15:00", home: "Chelsea", away: "Hull City" },
      { dateLabel: "Sat 12 Sep", kickoff: "15:00", home: "Crystal Palace", away: "Ipswich Town" },
      { dateLabel: "Sat 12 Sep", kickoff: "15:00", home: "Liverpool", away: "Fulham" },
      { dateLabel: "Sat 12 Sep", kickoff: "17:30", home: "Tottenham Hotspur", away: "Everton" },
      { dateLabel: "Sat 12 Sep", kickoff: "20:00", home: "Sunderland", away: "Arsenal" },
      { dateLabel: "Sun 13 Sep", kickoff: "14:00", home: "Coventry City", away: "Brighton & Hove Albion" },
      { dateLabel: "Sun 13 Sep", kickoff: "16:30", home: "Manchester United", away: "Manchester City" },
      { dateLabel: "Mon 14 Sep", kickoff: "20:00", home: "Leeds United", away: "Newcastle United" },
    ],
  },
];

const FIXTURES_BY_AUCTION: Record<number, AuctionMatchweek[]> = {
  9: PL_2627_MW1_TO_4,
};

export function getAuctionFixtures(auctionId: number): AuctionMatchweek[] | null {
  return FIXTURES_BY_AUCTION[auctionId] ?? null;
}
