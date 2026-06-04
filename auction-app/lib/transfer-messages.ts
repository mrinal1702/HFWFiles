import type { TransferErrorCode } from "@/lib/transfers";

export function transferErrorMessage(code: TransferErrorCode): string {
  switch (code) {
    case "transfer_window_closed":
      return "The transfer window is currently closed.";
    case "transfer_deadline_passed":
      return "The transfer deadline has passed — no new transfers can be made.";
    case "must_offer_something":
      return "You must include at least one player or some cash in your offer.";
    case "cannot_transfer_to_self":
      return "You can't propose a transfer to yourself.";
    case "player_not_owned_by_proposer":
      return "You no longer own one of the selected players. Refresh and try again.";
    case "player_not_owned_by_recipient":
      return "The other manager no longer owns one of the selected players. Refresh and try again.";
    case "player_already_in_transfer":
      return "One of the selected players is already locked in another active transfer.";
    case "proposer_insufficient_funds":
      return "You no longer have enough available budget to cover your cash offer. Cancel and re-propose after freeing up funds.";
    case "recipient_insufficient_funds":
      return "You don't have enough available budget to cover your cash offer.";
    case "proposer_squad_size_exceeded":
      return "This transfer would push your squad above the 18-player limit.";
    case "recipient_squad_size_exceeded":
      return "This transfer would push the other team above the 18-player limit.";
    case "proposer_goalkeeper_limit_exceeded":
      return "This transfer would give you more than one goalkeeper.";
    case "recipient_goalkeeper_limit_exceeded":
      return "This transfer would give the other team more than one goalkeeper.";
    case "already_confirmed":
      return "You've already confirmed this transfer.";
    case "transfer_not_found":
      return "Transfer not found. It may have been cancelled. Refresh the page.";
    case "transfer_already_closed":
      return "This transfer is already closed.";
    case "only_proposer_can_cancel":
      return "Only the manager who proposed this transfer can cancel it.";
    case "only_recipient_can_reject":
      return "Only the recipient of a transfer can reject it.";
    case "invalid_cash_amount":
      return "Cash amount must be a whole number of 0 or more.";
    default:
      return "Something went wrong. Refresh the page and try again.";
  }
}

export function transferStatusLabel(status: string): string {
  switch (status) {
    case "awaiting_response":
      return "Awaiting response";
    case "awaiting_confirmation":
      return "Awaiting confirmation";
    case "pending_admin":
      return "Awaiting admin approval";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function transferStatusColor(status: string): string {
  switch (status) {
    case "awaiting_response":
      return "bg-amber-100 text-amber-900";
    case "awaiting_confirmation":
      return "bg-sky-100 text-sky-900";
    case "pending_admin":
      return "bg-violet-100 text-violet-900";
    case "completed":
      return "bg-emerald-100 text-emerald-900";
    case "rejected":
      return "bg-red-100 text-red-900";
    case "cancelled":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
