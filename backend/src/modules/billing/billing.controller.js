import {
  applyBillDiscount,
  collectPayment,
  createRefund,
  createBill,
  getBillInvoice,
  getBillDetails,
  getBillingMasters,
  getBillingSummary,
  listBills,
  listPayments,
  listRefunds
} from "./billing.service.js";

export function billingMastersHandler(_req, res, next) {
  try {
    res.json(getBillingMasters());
  } catch (error) {
    next(error);
  }
}

export async function listBillsHandler(req, res, next) {
  try {
    res.json({ items: await listBills(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function listPaymentsHandler(req, res, next) {
  try {
    res.json({ items: await listPayments(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function listRefundsHandler(req, res, next) {
  try {
    res.json({ items: await listRefunds(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function createBillHandler(req, res, next) {
  try {
    res.status(201).json({ item: await createBill({ ...req.body, createdBy: req.user.sub }), message: "Bill created successfully." });
  } catch (error) {
    next(error);
  }
}

export async function billingSummaryHandler(_req, res, next) {
  try {
    res.json(await getBillingSummary());
  } catch (error) {
    next(error);
  }
}

export async function billDetailsHandler(req, res, next) {
  try {
    res.json(await getBillDetails(req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function collectPaymentHandler(req, res, next) {
  try {
    res.status(201).json({
      ...(await collectPayment(req.params.id, { ...req.body, receivedBy: req.user.sub })),
      message: "Payment collected successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function createPaymentHandler(req, res, next) {
  try {
    if (!req.body.billId) {
      throw Object.assign(new Error("billId is required."), { statusCode: 400, publicMessage: "billId is required." });
    }

    res.status(201).json({
      ...(await collectPayment(req.body.billId, { ...req.body, receivedBy: req.user.sub })),
      message: "Payment collected successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function applyDiscountHandler(req, res, next) {
  try {
    res.json({
      item: await applyBillDiscount(req.params.id, req.body, req.user.sub),
      message: "Discount applied successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function createRefundHandler(req, res, next) {
  try {
    res.status(201).json({
      ...(await createRefund(req.body, req.user.sub)),
      message: "Refund processed successfully."
    });
  } catch (error) {
    next(error);
  }
}

export async function invoiceHandler(req, res, next) {
  try {
    res.json(await getBillInvoice(req.params.id));
  } catch (error) {
    next(error);
  }
}
