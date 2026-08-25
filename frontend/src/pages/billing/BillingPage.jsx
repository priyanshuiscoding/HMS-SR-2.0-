import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { canPerformModuleAction } from "../../utils/accessModules.js";
import { formatCurrency } from "../../utils/format.js";
import {
  collectBillPayment,
  createBill,
  getBill,
  getBillingMasters,
  getBillingSummary,
  getBills,
  getPatients,
  getPayments,
  getPendingCharges
} from "../../services/api.js";

const initialPaymentForm = {
  amount: "",
  paymentMode: "cash",
  referenceNumber: "",
  note: ""
};

const initialBillForm = {
  discountAmount: "0",
  taxAmount: "0",
  notes: ""
};

const emptyExtraItem = { description: "", category: "service", quantity: "1", unitPrice: "" };

const SOURCE_LABELS = {
  consultation: "Consultation",
  lab: "Laboratory",
  pharmacy: "Pharmacy",
  therapy: "Panchkarma",
  ipd: "IPD stay"
};

const CATEGORY_LABELS = {
  consultation: "Consultation",
  lab: "Investigations",
  pharmacy: "Medicines",
  therapy: "Therapy",
  room: "Room & stay",
  procedure: "Procedures",
  service: "Other charges",
  miscellaneous: "Miscellaneous"
};

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(value) {
  if (value < 20) return ONES[value];
  return `${TENS[Math.floor(value / 10)]}${value % 10 ? ` ${ONES[value % 10]}` : ""}`;
}

function threeDigitWords(value) {
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  return [hundred ? `${ONES[hundred]} Hundred` : "", rest ? twoDigitWords(rest) : ""].filter(Boolean).join(" ");
}

// Indian numbering, because the printed bill is read by patients and auditors here.
function amountInWords(value) {
  const amount = Math.round(Number(value || 0));

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Zero Rupees Only";
  }

  const parts = [
    { count: Math.floor(amount / 10000000), label: "Crore" },
    { count: Math.floor((amount % 10000000) / 100000), label: "Lakh" },
    { count: Math.floor((amount % 100000) / 1000), label: "Thousand" }
  ]
    .filter((part) => part.count > 0)
    .map((part) => `${twoDigitWords(part.count)} ${part.label}`);

  const remainder = amount % 1000;
  if (remainder) {
    parts.push(threeDigitWords(remainder));
  }

  return `${parts.join(" ")} Rupees Only`;
}

function formatDisplayDate(value) {
  if (!value) return "";

  const isoDate = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [year, month, day] = isoDate.split("-");
    return `${day}-${month}-${year}`;
  }

  return value;
}

function chargeKey(charge) {
  return `${charge.source}:${charge.sourceId}`;
}

function groupItemsByCategory(items = []) {
  const groups = new Map();

  items.forEach((item) => {
    const category = item.category || "service";
    groups.set(category, [...(groups.get(category) || []), item]);
  });

  return [...groups.entries()].map(([category, groupItems]) => ({
    category,
    label: CATEGORY_LABELS[category] || category,
    items: groupItems,
    subtotal: groupItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  }));
}

// One printable sheet used for both the on-screen preview and the print copy.
function BillInvoiceSheet({ selectedBill, profile, copyLabel = "Patient copy" }) {
  const bill = selectedBill.item;
  const patient = selectedBill.patient;
  const invoiceMeta = bill.invoiceMeta || {};
  const groups = groupItemsByCategory(bill.items);
  const showBatchColumns = bill.items.some((item) => item.batchNumber || item.expiryDate || item.pack);
  const patientAddress =
    invoiceMeta.patientAddress ||
    [patient?.address, patient?.city, patient?.state, patient?.pincode].filter(Boolean).join(", ");
  const doctorName = invoiceMeta.doctorName || selectedBill.doctor?.fullName || "";
  const columnCount = showBatchColumns ? 8 : 5;

  return (
    <div className="bill-invoice-sheet">
      <header className="bill-invoice-head">
        <div className="bill-invoice-org">
          <div className="bill-invoice-org-name">{profile?.sellerName || "SR-AIIMS Hospital"}</div>
          {(profile?.addressLines || []).map((line) => (
            <div key={line}>{line}</div>
          ))}
          {profile?.phone ? <div>Phone: {profile.phone}</div> : null}
          {profile?.email ? <div>Email: {profile.email}</div> : null}
          {profile?.gstin ? <div>GSTIN: {profile.gstin}</div> : null}
        </div>
        <div className="bill-invoice-meta">
          <div className="bill-invoice-title">{profile?.invoiceTitle || "HOSPITAL INVOICE"}</div>
          <div><span>Bill No.</span><strong>{bill.billNumber}</strong></div>
          <div><span>Date</span><strong>{formatDisplayDate(bill.billDate)}</strong></div>
          <div><span>Type</span><strong>{bill.billType}</strong></div>
          <div><span>Status</span><strong>{bill.paymentStatus}</strong></div>
        </div>
      </header>

      <section className="bill-invoice-party">
        <div>
          <div><span>Patient</span><strong>{patient?.fullName || bill.patientName}</strong></div>
          <div><span>UHID</span><strong>{patient?.uhid || "-"}</strong></div>
          <div><span>Phone</span><strong>{patient?.phone || "-"}</strong></div>
          <div><span>Address</span><strong>{patientAddress || "-"}</strong></div>
        </div>
        <div>
          <div><span>Doctor</span><strong>{doctorName || "-"}</strong></div>
          <div><span>Reg. No.</span><strong>{invoiceMeta.doctorRegNo || "-"}</strong></div>
          <div><span>Visit</span><strong>{selectedBill.visit?.opdNumber || "-"}</strong></div>
          <div><span>Room / Bed</span><strong>{[selectedBill.room?.roomNumber, selectedBill.bed?.bedNumber].filter(Boolean).join(" / ") || "-"}</strong></div>
        </div>
      </section>

      <div className="table-shell bill-invoice-table-shell">
        <table className="data-table bill-invoice-table">
          <thead>
            <tr>
              <th className="col-sn">SN</th>
              <th>Particulars</th>
              {showBatchColumns ? <th>Pack</th> : null}
              {showBatchColumns ? <th>Batch</th> : null}
              {showBatchColumns ? <th>Expiry</th> : null}
              <th className="col-num">Qty</th>
              <th className="col-num">Rate</th>
              <th className="col-num">Amount</th>
            </tr>
          </thead>
          {groups.map((group, groupIndex) => (
            <tbody key={group.category}>
              <tr className="bill-invoice-group-row">
                <td colSpan={columnCount}>{group.label}</td>
              </tr>
              {group.items.map((item, index) => (
                <tr key={item.id}>
                  <td className="col-sn">{index + 1}</td>
                  <td>{item.description}</td>
                  {showBatchColumns ? <td>{item.pack || "-"}</td> : null}
                  {showBatchColumns ? <td>{item.batchNumber || "-"}</td> : null}
                  {showBatchColumns ? <td>{item.expiryDate ? formatDisplayDate(item.expiryDate) : "-"}</td> : null}
                  <td className="col-num">{item.quantity}</td>
                  <td className="col-num">{formatCurrency(item.unitPrice)}</td>
                  <td className="col-num">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              {groups.length > 1 ? (
                <tr className="bill-invoice-subtotal-row">
                  <td colSpan={columnCount - 1}>{group.label} subtotal</td>
                  <td className="col-num">{formatCurrency(group.subtotal)}</td>
                </tr>
              ) : null}
              {groupIndex === groups.length - 1 ? null : null}
            </tbody>
          ))}
        </table>
      </div>

      <section className="bill-invoice-foot">
        <div className="bill-invoice-notes">
          <div className="bill-invoice-words">
            <span>Amount in words</span>
            <strong>{amountInWords(bill.totalAmount)}</strong>
          </div>
          {bill.notes ? <div className="bill-invoice-remark"><span>Note</span> {bill.notes}</div> : null}
          {invoiceMeta.remark ? <div className="bill-invoice-remark"><span>Remark</span> {invoiceMeta.remark}</div> : null}
          {bill.payments?.length ? (
            <div className="bill-invoice-receipts">
              <span>Receipts</span>
              {bill.payments.map((payment) => (
                <div key={payment.id}>
                  {payment.receiptNumber} - Rs. {formatCurrency(payment.amount)} via {payment.paymentMode} on{" "}
                  {formatDisplayDate(payment.paymentDate)}
                </div>
              ))}
            </div>
          ) : null}
          {(profile?.terms || []).length ? (
            <div className="bill-invoice-terms">
              {(profile?.terms || []).map((term) => (
                <div key={term}>{term}</div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="bill-invoice-totals">
          <div><span>Subtotal</span><strong>{formatCurrency(bill.subtotal)}</strong></div>
          <div><span>Discount</span><strong>- {formatCurrency(bill.discountAmount)}</strong></div>
          <div><span>Tax</span><strong>{formatCurrency(bill.taxAmount)}</strong></div>
          <div className="bill-invoice-grand"><span>Grand Total</span><strong>Rs. {formatCurrency(bill.totalAmount)}</strong></div>
          <div><span>Paid</span><strong>{formatCurrency(bill.paidAmount)}</strong></div>
          {Number(bill.refundedAmount || 0) > 0 ? (
            <div><span>Refunded</span><strong>{formatCurrency(bill.refundedAmount)}</strong></div>
          ) : null}
          <div className="bill-invoice-balance"><span>Balance Due</span><strong>Rs. {formatCurrency(bill.balanceAmount)}</strong></div>
        </div>
      </section>

      <footer className="bill-invoice-signature">
        <span>{copyLabel}</span>
        <span>Authorised Signatory</span>
      </footer>
    </div>
  );
}

export function BillingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [masters, setMasters] = useState({ billTypes: [], paymentModes: [], itemCategories: [], invoiceProfiles: {} });
  const [selectedBill, setSelectedBill] = useState(null);
  const [filters, setFilters] = useState({ paymentStatus: "", billType: "", search: "" });
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [chargePatientId, setChargePatientId] = useState("");
  const [pendingCharges, setPendingCharges] = useState([]);
  const [selectedChargeKeys, setSelectedChargeKeys] = useState([]);
  const [billForm, setBillForm] = useState(initialBillForm);
  const [extraItems, setExtraItems] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canCreateBill = canPerformModuleAction(user, "billing", ["admin", "accounts", "doctor", "reception"]);
  const canCollectPayment = canPerformModuleAction(user, "billing", ["admin", "accounts", "reception"]);

  async function loadAll(nextFilters = filters, selectedId = selectedBill?.item?.id) {
    try {
      const [summaryResponse, billsResponse, paymentsResponse, patientsResponse, mastersResponse] = await Promise.all([
        getBillingSummary(),
        getBills(nextFilters),
        getPayments(),
        getPatients(),
        getBillingMasters()
      ]);

      setSummary(summaryResponse);
      setBills(billsResponse.items);
      setPayments(paymentsResponse.items.slice(0, 8));
      setPatients(patientsResponse.items);
      setMasters(mastersResponse);

      const activeId = selectedId || billsResponse.items[0]?.id;
      if (activeId) {
        const detail = await getBill(activeId);
        setSelectedBill(detail);
        setPaymentForm((current) => ({ ...current, amount: detail.item.balanceAmount > 0 ? String(detail.item.balanceAmount) : "" }));
      } else {
        setSelectedBill(null);
      }

      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load billing desk.");
    }
  }

  async function loadCharges(patientId) {
    if (!patientId) {
      setPendingCharges([]);
      setSelectedChargeKeys([]);
      return;
    }

    try {
      const response = await getPendingCharges({ patientId });
      setPendingCharges(response.items);
      // Pre-select everything outstanding: the desk almost always bills the whole visit.
      setSelectedChargeKeys(response.items.map(chargeKey));
      setError("");
    } catch (apiError) {
      setPendingCharges([]);
      setSelectedChargeKeys([]);
      setError(apiError.message || "Unable to load pending charges.");
    }
  }

  useEffect(() => {
    loadAll({ paymentStatus: "", billType: "", search: "" });
  }, []);

  const handleFilterChange = async (event) => {
    const nextFilters = { ...filters, [event.target.name]: event.target.value };
    setFilters(nextFilters);
    await loadAll(nextFilters);
  };

  const showPaymentQueue = async (paymentStatus) => {
    const nextFilters = { ...filters, paymentStatus };
    setFilters(nextFilters);
    await loadAll(nextFilters);
  };

  const handleBillSelect = async (billId) => {
    try {
      const detail = await getBill(billId);
      setSelectedBill(detail);
      setPaymentForm((current) => ({ ...current, amount: detail.item.balanceAmount > 0 ? String(detail.item.balanceAmount) : "" }));
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load bill detail.");
    }
  };

  const handleChargePatientChange = async (patientId) => {
    setChargePatientId(patientId);
    await loadCharges(patientId);
  };

  const toggleCharge = (key) => {
    setSelectedChargeKeys((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
  };

  const handleBillFormChange = (event) => {
    setBillForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleExtraItemChange = (index, field, value) => {
    setExtraItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  };

  const addExtraItem = () => setExtraItems((current) => [...current, { ...emptyExtraItem }]);
  const removeExtraItem = (index) => setExtraItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const selectedCharges = useMemo(
    () => pendingCharges.filter((charge) => selectedChargeKeys.includes(chargeKey(charge))),
    [pendingCharges, selectedChargeKeys]
  );

  const draftTotals = useMemo(() => {
    const chargeTotal = selectedCharges.reduce((sum, charge) => sum + Number(charge.total || 0), 0);
    const extraTotal = extraItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0
    );
    const subtotal = chargeTotal + extraTotal;
    const discountAmount = Number(billForm.discountAmount || 0);
    const taxAmount = Number(billForm.taxAmount || 0);

    return { subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount };
  }, [selectedCharges, extraItems, billForm]);

  const handleGenerateBill = async (event) => {
    event.preventDefault();

    if (!canCreateBill) {
      setError("You do not have permission to create bills.");
      return;
    }

    if (!chargePatientId) {
      setError("Select a patient first.");
      return;
    }

    const items = extraItems
      .filter((item) => item.description.trim() && Number(item.unitPrice || 0) >= 0)
      .map((item) => ({
        description: item.description.trim(),
        category: item.category || "service",
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0)
      }));

    if (!selectedCharges.length && !items.length) {
      setError("Select at least one pending charge or add another charge.");
      return;
    }

    try {
      const response = await createBill({
        patientId: chargePatientId,
        charges: selectedCharges.map((charge) => ({ source: charge.source, sourceId: charge.sourceId })),
        items,
        discountAmount: Number(billForm.discountAmount || 0),
        taxAmount: Number(billForm.taxAmount || 0),
        notes: billForm.notes
      });

      setMessage(`${response.message} (${response.item.billNumber})`);
      setBillForm(initialBillForm);
      setExtraItems([]);
      await loadCharges(chargePatientId);
      await loadAll(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to create bill.");
    }
  };

  const handlePaymentFormChange = (event) => {
    setPaymentForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleCollectPayment = async (event) => {
    event.preventDefault();
    if (!selectedBill?.item?.id) return;

    if (!canCollectPayment) {
      setError("You do not have permission to collect payments.");
      return;
    }

    try {
      const response = await collectBillPayment(selectedBill.item.id, paymentForm);
      setMessage(response.message);
      setPaymentForm(initialPaymentForm);
      await loadAll(filters, selectedBill.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to collect payment.");
    }
  };

  // Print only the invoice sheet: the desk prints on a shared counter printer and
  // the rest of the workspace must never end up on the patient copy.
  const printInvoice = () => {
    if (!selectedBill?.item) return;

    const cleanup = () => {
      document.body.classList.remove("print-bill-invoice");
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("print-bill-invoice");
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  const invoiceProfile = selectedBill?.item?.billType === "pharmacy"
    ? masters.invoiceProfiles?.pharmacy
    : masters.invoiceProfiles?.hospital;
  const patientLabel = (patient) => `${patient.uhid || patient.registrationNumber || "UHID"} - ${patient.firstName || ""} ${patient.lastName || ""}`.trim();

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">Billing Desk</div>
        <h2>Every charge from registration to pharmacy comes here for one final bill.</h2>
        <p>
          Consultation, investigations, medicines, therapy and IPD stay charges collect against the patient as they
          move through the hospital. The billing desk picks them up, raises a single invoice, and collects payment.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card"><div className="stat-label">Bills</div><div className="stat-value">{summary?.totalBills || 0}</div><div className="stat-note">Registered invoices</div></article>
        <article className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">Rs. {summary?.totalRevenue || 0}</div><div className="stat-note">Collected till now</div></article>
        <article className="stat-card"><div className="stat-label">Outstanding</div><div className="stat-value">Rs. {summary?.outstanding || 0}</div><div className="stat-note">Pending collections</div></article>
        <article className="stat-card"><div className="stat-label">Today</div><div className="stat-value">Rs. {summary?.todayCollections || 0}</div><div className="stat-note">Collected today</div></article>
      </section>

      <section className="content-card">
        <div className="section-header">
          <div><div className="eyebrow">Payment Queue</div><h3>Separate unpaid and partial bills</h3></div>
          <div className="action-row">
            <Button variant="secondary" onClick={() => showPaymentQueue("unpaid")}>Unpaid {summary?.unpaidBills || 0}</Button>
            <Button variant="secondary" onClick={() => showPaymentQueue("partial")}>Partial {summary?.partialBills || 0}</Button>
            <Button variant="secondary" onClick={() => showPaymentQueue("")}>All Bills</Button>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="content-card">
          <div className="section-header">
            <div><div className="eyebrow">New Bill</div><h3>Pending charges</h3></div>
            <Button variant="secondary" onClick={addExtraItem} disabled={!canCreateBill}>Add Other Charge</Button>
          </div>

          <form className="form-grid" onSubmit={handleGenerateBill}>
            <div className="field field-span-2">
              <label>Patient</label>
              <SearchableSelect
                value={chargePatientId}
                options={patients}
                loadOptions={(query) => getPatients(query, { pageSize: 30 }).then((response) => response.items || [])}
                onChange={handleChargePatientChange}
                placeholder="Search patient by name, UHID, phone, father name, or city"
                emptyLabel="No matching patient"
                getOptionLabel={patientLabel}
                getOptionMeta={(patient) => [patient.phone, patient.fatherName, patient.cityDistrict || patient.city].filter(Boolean).join(" | ")}
                getSearchText={(patient) => [
                  patient.uhid,
                  patient.registrationNumber,
                  patient.firstName,
                  patient.lastName,
                  patient.fatherName,
                  patient.phone,
                  patient.cityDistrict,
                  patient.city
                ].filter(Boolean).join(" ")}
              />
            </div>

            <div className="field field-span-2">
              <label>Unbilled charges</label>
              {!chargePatientId ? (
                <div className="empty-state">Select a patient to see everything pending against them.</div>
              ) : pendingCharges.length ? (
                <div className="stack-list compact-list">
                  {pendingCharges.map((charge) => {
                    const key = chargeKey(charge);

                    return (
                      <label key={key} className={`charge-row${selectedChargeKeys.includes(key) ? " charge-row-selected" : ""}`}>
                        <input type="checkbox" checked={selectedChargeKeys.includes(key)} onChange={() => toggleCharge(key)} />
                        <span className="charge-row-body">
                          <strong>{charge.label}</strong>
                          <span className="timeline-copy">{SOURCE_LABELS[charge.source] || charge.source} | {formatDisplayDate(charge.chargeDate)}</span>
                          <span className="timeline-copy">
                            {charge.items.map((item) => `${item.description} x${item.quantity}`).join(", ")}
                          </span>
                        </span>
                        <span className="charge-row-total">Rs. {formatCurrency(charge.total)}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">Nothing pending for this patient. Everything so far has been billed.</div>
              )}
            </div>

            {extraItems.length ? (
              <div className="field field-span-2">
                <label>Other charges</label>
                <div className="stack-list compact-list">
                  {extraItems.map((item, index) => (
                    <div key={`extra-${index}`} className="medicine-card">
                      <div className="form-grid">
                        <div className="field field-span-2"><label>Description</label><input value={item.description} onChange={(event) => handleExtraItemChange(index, "description", event.target.value)} /></div>
                        <div className="field"><label>Category</label><select value={item.category} onChange={(event) => handleExtraItemChange(index, "category", event.target.value)}>{masters.itemCategories.map((category) => (<option key={category} value={category}>{category}</option>))}</select></div>
                        <div className="field"><label>Quantity</label><input value={item.quantity} onChange={(event) => handleExtraItemChange(index, "quantity", event.target.value)} /></div>
                        <div className="field"><label>Unit price</label><input value={item.unitPrice} onChange={(event) => handleExtraItemChange(index, "unitPrice", event.target.value)} /></div>
                        <div className="field"><label>&nbsp;</label><Button type="button" variant="secondary" onClick={() => removeExtraItem(index)}>Remove</Button></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field"><label>Discount</label><input name="discountAmount" value={billForm.discountAmount} onChange={handleBillFormChange} /></div>
            <div className="field"><label>Tax</label><input name="taxAmount" value={billForm.taxAmount} onChange={handleBillFormChange} /></div>
            <div className="field field-span-2"><label>Notes</label><input name="notes" value={billForm.notes} onChange={handleBillFormChange} /></div>

            <div className="field field-span-2">
              <div className="bill-draft-summary">
                <div><span>Selected</span><strong>{selectedCharges.length} charge{selectedCharges.length === 1 ? "" : "s"}</strong></div>
                <div><span>Subtotal</span><strong>Rs. {formatCurrency(draftTotals.subtotal)}</strong></div>
                <div><span>Discount</span><strong>- Rs. {formatCurrency(draftTotals.discountAmount)}</strong></div>
                <div><span>Tax</span><strong>Rs. {formatCurrency(draftTotals.taxAmount)}</strong></div>
                <div className="bill-draft-total"><span>Bill total</span><strong>Rs. {formatCurrency(draftTotals.total)}</strong></div>
              </div>
            </div>

            <div className="field field-span-2">
              <Button type="submit" disabled={!canCreateBill || !chargePatientId || (!selectedCharges.length && !extraItems.length)}>
                Generate Bill
              </Button>
            </div>
          </form>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Recent Payments</div><h3>Latest receipt activity</h3></div></div>
          <div className="stack-list">{payments.map((payment) => (<div key={payment.id} className="quick-action"><strong>{payment.receiptNumber}</strong><div className="timeline-copy">{payment.patientName}</div><div className="timeline-copy">Rs. {payment.amount} via {payment.paymentMode}</div><div className="timeline-copy">{formatDisplayDate(payment.paymentDate)}</div></div>))}{!payments.length ? <div className="empty-state">No payments recorded yet.</div> : null}</div>
        </article>
      </section>

      <section className="opd-grid">
        <aside className="content-card">
          <div className="section-header"><div><div className="eyebrow">Invoices</div><h3>Bill register</h3></div></div>
          <div className="toolbar">
            <input className="search-input" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search by bill, patient, note" />
            <select name="billType" value={filters.billType} onChange={handleFilterChange}><option value="">All bill types</option>{masters.billTypes.map((type) => (<option key={type} value={type}>{type}</option>))}</select>
            <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange}><option value="">All statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option></select>
          </div>
          <div className="queue-list">{bills.map((bill) => (<div key={bill.id} className={`queue-item selectable-card${selectedBill?.item?.id === bill.id ? " selected-card" : ""}`} onClick={() => handleBillSelect(bill.id)} role="button" tabIndex={0}><div><strong>{bill.billNumber}</strong><div className="timeline-copy">{bill.patientName}</div><div className="timeline-copy">{bill.billType} | Rs. {bill.totalAmount}</div><div className="timeline-copy">{formatDisplayDate(bill.billDate)}</div></div><div className="queue-actions"><span className={`status-pill ${bill.paymentStatus === "partial" ? "in_progress" : bill.paymentStatus === "paid" ? "completed" : "cancelled"}`}>{bill.paymentStatus}</span></div></div>))}{!bills.length ? <div className="empty-state">No bills found for the selected filters.</div> : null}</div>
        </aside>

        <section className="consultation-column">
          <article className="content-card">
            <div className="section-header no-print"><div><div className="eyebrow">Invoice Detail</div><h3>{selectedBill?.item?.billNumber || "Select a bill"}</h3></div><Button variant="secondary" onClick={printInvoice} disabled={!selectedBill?.item}>Print Invoice</Button></div>
            {error ? <div className="error-text no-print">{error}</div> : null}
            {message ? <div className="success-text no-print">{message}</div> : null}
            {selectedBill?.item ? (
              <BillInvoiceSheet selectedBill={selectedBill} profile={invoiceProfile} />
            ) : (
              <div className="empty-state">Choose a bill from the register to open its invoice.</div>
            )}
          </article>

          <article className="content-card">
            <div className="section-header"><div><div className="eyebrow">Collect Payment</div><h3>Receipt entry</h3></div></div>
            <form className="form-grid" onSubmit={handleCollectPayment}>
              <div className="field"><label>Amount</label><input name="amount" value={paymentForm.amount} onChange={handlePaymentFormChange} /></div>
              <div className="field"><label>Payment mode</label><select name="paymentMode" value={paymentForm.paymentMode} onChange={handlePaymentFormChange}>{masters.paymentModes.map((mode) => (<option key={mode} value={mode}>{mode}</option>))}</select></div>
              <div className="field"><label>Reference number</label><input name="referenceNumber" value={paymentForm.referenceNumber} onChange={handlePaymentFormChange} /></div>
              <div className="field field-span-2"><label>Note</label><input name="note" value={paymentForm.note} onChange={handlePaymentFormChange} /></div>
              <div className="field field-span-2"><Button type="submit" disabled={!canCollectPayment || !selectedBill?.item || selectedBill.item.balanceAmount <= 0}>Collect Payment</Button></div>
            </form>
            {!canCollectPayment ? <div className="empty-state" style={{ marginTop: 18 }}>Receipt collection is limited to admin, reception, and accounts roles.</div> : null}
            {selectedBill?.item?.payments?.length ? <div className="stack-list" style={{ marginTop: 18 }}>{selectedBill.item.payments.map((payment) => (<div key={payment.id} className="quick-action"><strong>{payment.receiptNumber}</strong><div className="timeline-copy">Rs. {payment.amount} via {payment.paymentMode}</div><div className="timeline-copy">{payment.referenceNumber || "No reference"}</div><div className="timeline-copy">{formatDisplayDate(payment.paymentDate)}</div></div>))}</div> : <div className="empty-state" style={{ marginTop: 18 }}>No payments recorded for this bill yet.</div>}
          </article>
        </section>
      </section>

      {selectedBill?.item ? (
        <section className="bill-print-sheet" aria-hidden="true">
          <BillInvoiceSheet selectedBill={selectedBill} profile={invoiceProfile} />
        </section>
      ) : null}
    </DashboardLayout>
  );
}
