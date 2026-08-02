import { createApiHandler } from "@/lib/api/handler";
import {
  deliveryOrderIdParamsSchema,
  recordOrderPaymentSchema,
} from "@/lib/validation/delivery-order";
import { recordOrderPayment } from "@/lib/services/delivery-order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[id]/payments — money in, or money back out.
 *
 * ONE endpoint for both directions, because they are one table and one act:
 * `direction` is `IN` for an instalment and `OUT` for a refund. It arrives in
 * the body, fixed by which button opened the modal, and is never a toggle the
 * user can flip mid-entry — mixing the two up is the most costly mistake
 * available on this screen.
 *
 * ONE SUBMISSION MAY WRITE SEVERAL ROWS. §5 takes a cash amount plus repeatable
 * coin rows, and `payments` carries one `mode` per row — which is exactly what
 * makes `paid_cash_amount`, `paid_coin_amount` and `paid_other_amount` on the
 * header meaningful. They commit together or not at all.
 *
 * COINS COLLECTED HERE GO BACK INTO STOCK automatically, through one
 * `ORDER_RECEIPT` row in `coin_ledger_entries` per coin type. §5.1: "this is
 * the return leg of the coin lifecycle and it happens automatically — you never
 * record it twice." `coin_unit_value` is a `rate6` snapshot taken under the
 * coin type's row lock, so repricing that coin next month cannot rewrite what
 * today's payment was worth.
 *
 * OVERPAYMENT IS ALLOWED and flagged amber by the UI, never blocked: a cash
 * business takes round-number payments constantly, and refusing ₹2,000 against
 * a ₹1,940 balance just teaches staff to record false amounts. A REFUND larger
 * than what is owed back is refused — that is money leaving against nothing.
 *
 * `payments` is APPEND-ONLY, so there is no PATCH: a wrong payment is corrected
 * by a reversing row that points back at it. `clientRequestId` makes a
 * double-tap on a flaky connection return the FIRST attempt's result instead of
 * taking the money twice.
 */
export const POST = createApiHandler({
  name: "POST /api/orders/[id]/payments",
  roles: ["OWNER", "ADMIN"],
  params: deliveryOrderIdParamsSchema,
  body: recordOrderPaymentSchema,
  status: 201,
  handler: ({ params, body, ctx }) =>
    recordOrderPayment(params.id, body, ctx.userId),
});
