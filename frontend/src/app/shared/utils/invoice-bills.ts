/**
 * Fatura de cartão vista como conta a pagar.
 *
 * Compra no cartão não sai do caixa na data da compra — sai quando a fatura
 * vence. Por isso as telas de caixa (Visão Geral, Compromissos, Previsão)
 * pedem os lançamentos com `no_card=true` e somam as faturas por aqui, cada
 * uma como UMA linha na data do vencimento.
 *
 * O vencimento vem calculado do backend (/reports/card-invoices-due), a
 * partir do ciclo de fechamento do cartão. Nada de recalcular em cada tela.
 */

/** Resposta de /reports/card-invoices-due. */
export interface InvoiceDue {
  card_id: string;
  card_name: string;
  color: string;
  icon: string;
  /** Competência da fatura (YYYY-MM). */
  month: string;
  /** Data em que a fatura vence (YYYY-MM-DD). */
  due_date: string;
  amount: number;
  count: number;
}

/** Conta a pagar sintética, no formato que as telas já consomem. */
export interface InvoiceBill {
  id: string;
  description: string;
  date: string;
  amount: number;
  type: 'expense';
  paid: false;
  /** Marca a linha como fatura: o clique leva à tela do cartão, não a "pagar". */
  kind: 'invoice';
  card_id: string;
  month: string;
  card_name: string;
}

export function invoicesAsBills(list: InvoiceDue[]): InvoiceBill[] {
  return (list ?? []).map(inv => ({
    // Id estável e sem colisão com id de lançamento (uuid), para o `track`.
    id: `invoice:${inv.card_id}:${inv.month}`,
    description: `Fatura ${inv.card_name}`,
    date: inv.due_date,
    amount: Math.abs(inv.amount ?? 0),
    type: 'expense' as const,
    paid: false as const,
    kind: 'invoice' as const,
    card_id: inv.card_id,
    month: inv.month,
    card_name: inv.card_name,
  }));
}
