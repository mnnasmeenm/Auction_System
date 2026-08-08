import { supabase } from "./supabase";

export interface BidIncrementRule {
  id: string;
  tournament_id: string;
  from_amount: number;
  to_amount: number | null;
  increment_amount: number;
  display_order: number;
}

export interface BidIncrementRuleInput {
  fromAmount: number;
  toAmount: number | null;
  incrementAmount: number;
}

export async function getBidIncrementRules(
  tournamentId: string
): Promise<BidIncrementRule[]> {
  const { data, error } = await supabase
    .from("bid_increment_rules")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("display_order");

  if (error) {
    throw error;
  }

  return (data ?? []) as BidIncrementRule[];
}

export async function replaceBidIncrementRules(
  tournamentId: string,
  rules: BidIncrementRuleInput[]
): Promise<void> {
  const { error } = await supabase.rpc(
    "replace_bid_increment_rules",
    {
      p_tournament_id: tournamentId,
      p_from_amounts: rules.map(
        (rule) => rule.fromAmount
      ),
      p_to_amounts: rules.map(
        (rule) => rule.toAmount
      ),
      p_increment_amounts: rules.map(
        (rule) => rule.incrementAmount
      )
    }
  );

  if (error) {
    throw error;
  }
}

export function getRuleForBid(
  rules: BidIncrementRule[],
  currentBid: number
): BidIncrementRule | null {
  return (
    rules.find(
      (rule) =>
        currentBid >= rule.from_amount &&
        (
          rule.to_amount === null ||
          currentBid < rule.to_amount
        )
    ) ?? null
  );
}