import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { formatCurrency } from "../../utils/format.js";
import {
  collectBillPayment,
  createBill,
  getBill,
  getBillingMasters,
  getBillingSummary,
  getBills,
  getPatients,
  getPayments
} from "../../services/api.js";

const initialPaymentForm = {
  amount: "",
  paymentMode: "cash",
  referenceNumber: "",
  note: ""
};

const initialCreateBillForm = {
  patientId: "",
  billType: "opd",
  notes: "",
  discountAmount: "0",
  taxAmount: "0",
  invoiceMeta: {
    doctorName: "",
    doctorRegNo: "",
    patientAddress: "",
    remark: ""
  },
  items: [
    { description: "", category: "service", quantity: 1, unitPrice: "", batchNumber: "", pack: "", expiryDate: "" }
  ]
};

function formatDisplayDate(value) {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
  }

  return value;
}

function GenericInvoice({ selectedBill, invoiceTotals }) {
  return (
    <div className="invoice-sheet">
      <div className="invoice-header">
        <div>
          <div className="eyebrow">Shanti-Ratnam</div>
          <h3>SR-AIIMS Billing Invoice</h3>
          <div className="timeline-copy">Healing With Happiness</div>
        </div>
        <div className="detail-list compact-detail">
          <div><strong>Bill:</strong> {selectedBill.item.billNumber}</div>
          <div><strong>Date:</strong> {selectedBill.item.billDate}</div>
          <div><strong>Status:</strong> {selectedBill.item.paymentStatus}</div>
        </div>
      </div>
      <div className="detail-grid">
        <article className="content-card inset-card">
          <h3>Patient</h3>
          <div className="detail-list">
            <div><strong>Name:</strong> {selectedBill.patient?.firstName} {selectedBill.patient?.lastName}</div>
            <div><strong>UHID:</strong> {selectedBill.patient?.uhid || "N/A"}</div>
            <div><strong>Phone:</strong> {selectedBill.patient?.phone || "N/A"}</div>
          </div>
        </article>
        <article className="content-card inset-card">
          <h3>Source</h3>
          <div className="detail-list">
            <div><strong>Visit:</strong> {selectedBill.visit?.opdNumber || "N/A"}</div>
            <div><strong>Room:</strong> {selectedBill.room?.roomNumber || "N/A"}</div>
            <div><strong>Bed:</strong> {selectedBill.bed?.bedNumber || "N/A"}</div>
            <div><strong>Type:</strong> {selectedBill.item.billType}</div>
          </div>
        </article>
      </div>
      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {selectedBill.item.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.category}</td>
                <td>{item.quantity}</td>
                <td>Rs. {formatCurrency(item.unitPrice)}</td>
                <td>Rs. {formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="invoice-summary">
        <div><strong>Subtotal:</strong> Rs. {formatCurrency(invoiceTotals?.subtotal)}</div>
        <div><strong>Discount:</strong> Rs. {formatCurrency(invoiceTotals?.discountAmount)}</div>
        <div><strong>Tax:</strong> Rs. {formatCurrency(invoiceTotals?.taxAmount)}</div>
        <div><strong>Total:</strong> Rs. {formatCurrency(invoiceTotals?.totalAmount)}</div>
        <div><strong>Paid:</strong> Rs. {formatCurrency(invoiceTotals?.paidAmount)}</div>
        <div><strong>Balance:</strong> Rs. {formatCurrency(invoiceTotals?.balanceAmount)}</div>
      </div>
    </div>
  );
}

function PharmacyInvoice({ selectedBill, invoiceTotals, profile }) {
  const invoiceMeta = selectedBill.item.invoiceMeta || {};
  const patientAddress = invoiceMeta.patientAddress || [selectedBill.patient?.address, selectedBill.patient?.city, selectedBill.patient?.state, selectedBill.patient?.pincode].filter(Boolean).join(", ");
  const doctorName = invoiceMeta.doctorName || selectedBill.doctor?.fullName || "";

  return (
    <div className="pharmacy-invoice-sheet">
      <div className="pharmacy-invoice-top">
        <div className="pharmacy-store-block">
          <h2>{profile?.sellerName || "Pharmacy Invoice"}</h2>
          {(profile?.addressLines || []).map((line) => <div key={line}>{line}</div>)}
          <div>Phone: {profile?.phone || "N/A"}</div>
          <div>Website: {profile?.website || "N/A"}</div>
          <div>Email: {profile?.email || "N/A"}</div>
          <div>GSTIN: {profile?.gstin || "N/A"}</div>
        </div>
        <div className="pharmacy-title-block">
          <div className="pharmacy-invoice-title">{profile?.invoiceTitle || "GST INVOICE"}</div>
          <div><strong>Invoice No.:</strong> {selectedBill.item.billNumber}</div>
          <div><strong>Date:</strong> {formatDisplayDate(selectedBill.item.billDate)}</div>
        </div>
      </div>

      <div className="pharmacy-party-grid">
        <div className="pharmacy-party-card">
          <div><strong>Patient Name:</strong> {selectedBill.patient ? `${selectedBill.patient.firstName} ${selectedBill.patient.lastName}` : selectedBill.item.patientName}</div>
          <div><strong>Patient Address:</strong> {patientAddress || "N/A"}</div>
        </div>
        <div className="pharmacy-party-card">
          <div><strong>Dr Name:</strong> {doctorName || "N/A"}</div>
          <div><strong>Dr Reg No.:</strong> {invoiceMeta.doctorRegNo || "N/A"}</div>
          <div><strong>Status:</strong> {selectedBill.item.paymentStatus}</div>
        </div>
      </div>

      <div className="table-shell pharmacy-table-shell">
        <table className="data-table pharmacy-table">
          <thead>
            <tr>
              <th>SN.</th>
              <th>Product Name</th>
              <th>Exp.</th>
              <th>Pack</th>
              <th>Batch</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {selectedBill.item.items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.description}</td>
                <td>{item.expiryDate || "-"}</td>
                <td>{item.pack || "-"}</td>
                <td>{item.batchNumber || "-"}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.unitPrice)}</td>
                <td>{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pharmacy-invoice-footer-grid">
        <div className="pharmacy-terms-block">
          <h4>Terms &amp; Conditions</h4>
          {(profile?.terms || []).map((term) => <div key={term}>{term}</div>)}
          <div className="pharmacy-meta-line"><strong>Remark:</strong> {invoiceMeta.remark || selectedBill.item.notes || "-"}</div>
          <div className="pharmacy-prepared-row">
            <span>BILLING BY ................</span>
            <span>MED COLLECTION BY ................</span>
          </div>
          <div className="pharmacy-prepared-row">
            <span>PREPARED BY ................</span>
            <span>CHECKED &amp; DISPATCHED BY ................</span>
          </div>
        </div>
        <div className="pharmacy-total-block">
          <div><strong>Subtotal:</strong> {formatCurrency(invoiceTotals?.subtotal)}</div>
          <div><strong>Discount:</strong> {formatCurrency(invoiceTotals?.discountAmount)}</div>
          <div><strong>Tax:</strong> {formatCurrency(invoiceTotals?.taxAmount)}</div>
          <div className="pharmacy-total-line"><strong>TOTAL C/F</strong><span>{formatCurrency(invoiceTotals?.totalAmount)}</span></div>
          <div><strong>Paid:</strong> {formatCurrency(invoiceTotals?.paidAmount)}</div>
          <div><strong>Balance:</strong> {formatCurrency(invoiceTotals?.balanceAmount)}</div>
          <div className="pharmacy-signature">Authorised Signatory</div>
        </div>
      </div>
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
  const [createBillForm, setCreateBillForm] = useState(initialCreateBillForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  useEffect(() => {
    loadAll({ paymentStatus: "", billType: "", search: "" });
  }, []);

  const handleFilterChange = async (event) => {
    const nextFilters = { ...filters, [event.target.name]: event.target.value };
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

  const handlePaymentFormChange = (event) => {
    setPaymentForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleCollectPayment = async (event) => {
    event.preventDefault();
    if (!selectedBill?.item?.id) {
      return;
    }

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

  const handleCreateBillChange = (event) => {
    setCreateBillForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleCreateBillPatientChange = (patientId) => {
    setCreateBillForm((current) => ({ ...current, patientId }));
  };

  const handleInvoiceMetaChange = (event) => {
    const { name, value } = event.target;
    setCreateBillForm((current) => ({
      ...current,
      invoiceMeta: {
        ...current.invoiceMeta,
        [name]: value
      }
    }));
  };

  const handleBillItemChange = (index, field, value) => {
    setCreateBillForm((current) => {
      const items = [...current.items];
      items[index] = { ...items[index], [field]: value };
      return { ...current, items };
    });
  };

  const addBillItem = () => {
    setCreateBillForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          description: "",
          category: current.billType === "pharmacy" ? "pharmacy" : masters.itemCategories[0] || "service",
          quantity: 1,
          unitPrice: "",
          batchNumber: "",
          pack: "",
          expiryDate: ""
        }
      ]
    }));
  };

  const handleCreateBill = async (event) => {
    event.preventDefault();

    if (!canCreateBill) {
      setError("You do not have permission to create bills.");
      return;
    }

    try {
      const response = await createBill({
        ...createBillForm,
        items: createBillForm.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0)
        }))
      });
      setMessage(response.message);
      setCreateBillForm(initialCreateBillForm);
      await loadAll(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to create bill.");
    }
  };

  const invoiceTotals = useMemo(() => {
    if (!selectedBill?.item) {
      return null;
    }

    return {
      subtotal: selectedBill.item.subtotal,
      discountAmount: selectedBill.item.discountAmount,
      taxAmount: selectedBill.item.taxAmount,
      totalAmount: selectedBill.item.totalAmount,
      paidAmount: selectedBill.item.paidAmount,
      balanceAmount: selectedBill.item.balanceAmount
    };
  }, [selectedBill]);

  const isPharmacyCreateMode = createBillForm.billType === "pharmacy";
  const isPharmacyInvoice = selectedBill?.item?.billType === "pharmacy";
  const pharmacyProfile = masters.invoiceProfiles?.pharmacy;
  const canCreateBill = ["admin", "accounts", "doctor", "reception"].includes(user?.role);
  const canCollectPayment = ["admin", "accounts", "reception"].includes(user?.role);
  const patientLabel = (patient) => `${patient.uhid || patient.registrationNumber || "UHID"} - ${patient.firstName || ""} ${patient.lastName || ""}`.trim();

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">Billing Desk</div>
        <h2>Manage invoice creation, receipt collection, and account visibility from one billing base.</h2>
        <p>
          This implementation upgrades billing from a consultation hook into a proper accounts workspace with
          manual bill creation, payment history, status filtering, and print-ready invoice review.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card"><div className="stat-label">Bills</div><div className="stat-value">{summary?.totalBills || 0}</div><div className="stat-note">Registered invoices</div></article>
        <article className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">Rs. {summary?.totalRevenue || 0}</div><div className="stat-note">Collected till now</div></article>
        <article className="stat-card"><div className="stat-label">Outstanding</div><div className="stat-value">Rs. {summary?.outstanding || 0}</div><div className="stat-note">Pending collections</div></article>
        <article className="stat-card"><div className="stat-label">Today</div><div className="stat-value">Rs. {summary?.todayCollections || 0}</div><div className="stat-note">Collected today</div></article>
      </section>

      <section className="workspace-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Create Bill</div><h3>Manual invoice entry</h3></div><Button variant="secondary" onClick={addBillItem} disabled={!canCreateBill}>Add Item</Button></div>
          <form className="form-grid" onSubmit={handleCreateBill}>
            <div className="field field-span-2">
              <label>Patient</label>
              <SearchableSelect
                value={createBillForm.patientId}
                options={patients}
                onChange={handleCreateBillPatientChange}
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
            <div className="field"><label>Bill type</label><select name="billType" value={createBillForm.billType} onChange={handleCreateBillChange}>{masters.billTypes.map((type) => (<option key={type} value={type}>{type}</option>))}</select></div>
            <div className="field"><label>Discount</label><input name="discountAmount" value={createBillForm.discountAmount} onChange={handleCreateBillChange} /></div>
            <div className="field"><label>Tax</label><input name="taxAmount" value={createBillForm.taxAmount} onChange={handleCreateBillChange} /></div>
            <div className="field field-span-2"><label>Notes</label><input name="notes" value={createBillForm.notes} onChange={handleCreateBillChange} /></div>
            {isPharmacyCreateMode ? (
              <>
                <div className="field"><label>Doctor name</label><input name="doctorName" value={createBillForm.invoiceMeta.doctorName} onChange={handleInvoiceMetaChange} /></div>
                <div className="field"><label>Doctor reg no</label><input name="doctorRegNo" value={createBillForm.invoiceMeta.doctorRegNo} onChange={handleInvoiceMetaChange} /></div>
                <div className="field field-span-2"><label>Patient address override</label><input name="patientAddress" value={createBillForm.invoiceMeta.patientAddress} onChange={handleInvoiceMetaChange} placeholder="Leave blank to use patient master address" /></div>
                <div className="field field-span-2"><label>Remark</label><input name="remark" value={createBillForm.invoiceMeta.remark} onChange={handleInvoiceMetaChange} /></div>
              </>
            ) : null}
            <div className="field field-span-2">
              <label>Bill items</label>
              <div className="stack-list compact-list">
                {createBillForm.items.map((item, index) => (
                  <div key={`item-${index}`} className="medicine-card">
                    <div className="form-grid">
                      <div className="field field-span-2"><label>{isPharmacyCreateMode ? "Product name" : "Description"}</label><input value={item.description} onChange={(event) => handleBillItemChange(index, "description", event.target.value)} /></div>
                      <div className="field"><label>Category</label><select value={item.category} onChange={(event) => handleBillItemChange(index, "category", event.target.value)}>{masters.itemCategories.map((category) => (<option key={category} value={category}>{category}</option>))}</select></div>
                      <div className="field"><label>Quantity</label><input value={item.quantity} onChange={(event) => handleBillItemChange(index, "quantity", event.target.value)} /></div>
                      <div className="field"><label>Unit price</label><input value={item.unitPrice} onChange={(event) => handleBillItemChange(index, "unitPrice", event.target.value)} /></div>
                      {isPharmacyCreateMode ? (
                        <>
                          <div className="field"><label>Pack</label><input value={item.pack} onChange={(event) => handleBillItemChange(index, "pack", event.target.value)} placeholder="1TAB / 1GM" /></div>
                          <div className="field"><label>Batch</label><input value={item.batchNumber} onChange={(event) => handleBillItemChange(index, "batchNumber", event.target.value)} /></div>
                          <div className="field"><label>Expiry</label><input value={item.expiryDate} onChange={(event) => handleBillItemChange(index, "expiryDate", event.target.value)} placeholder="MM/YY" /></div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="field field-span-2"><Button type="submit" disabled={!canCreateBill}>Create Bill</Button></div>
          </form>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Recent Payments</div><h3>Latest receipt activity</h3></div></div>
          <div className="stack-list">{payments.map((payment) => (<div key={payment.id} className="quick-action"><strong>{payment.receiptNumber}</strong><div className="timeline-copy">{payment.patientName}</div><div className="timeline-copy">Rs. {payment.amount} via {payment.paymentMode}</div><div className="timeline-copy">{payment.paymentDate}</div></div>))}{!payments.length ? <div className="empty-state">No payments recorded yet.</div> : null}</div>
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
          <div className="queue-list">{bills.map((bill) => (<div key={bill.id} className={`queue-item selectable-card${selectedBill?.item?.id === bill.id ? " selected-card" : ""}`} onClick={() => handleBillSelect(bill.id)} role="button" tabIndex={0}><div><strong>{bill.billNumber}</strong><div className="timeline-copy">{bill.patientName}</div><div className="timeline-copy">{bill.billType} | Rs. {bill.totalAmount}</div><div className="timeline-copy">{bill.billDate}</div></div><div className="queue-actions"><span className={`status-pill ${bill.paymentStatus === "partial" ? "in_progress" : bill.paymentStatus === "paid" ? "completed" : "cancelled"}`}>{bill.paymentStatus}</span></div></div>))}{!bills.length ? <div className="empty-state">No bills found for the selected filters.</div> : null}</div>
        </aside>

        <section className="consultation-column">
          <article className="content-card printable-area">
            <div className="section-header no-print"><div><div className="eyebrow">Invoice Detail</div><h3>{selectedBill?.item?.billNumber || "Select a bill"}</h3></div><Button variant="secondary" onClick={() => window.print()} disabled={!selectedBill?.item}>Print Invoice</Button></div>
            {error ? <div className="error-text no-print">{error}</div> : null}
            {message ? <div className="success-text no-print">{message}</div> : null}
            {selectedBill?.item ? (isPharmacyInvoice ? <PharmacyInvoice selectedBill={selectedBill} invoiceTotals={invoiceTotals} profile={pharmacyProfile} /> : <GenericInvoice selectedBill={selectedBill} invoiceTotals={invoiceTotals} />) : <div className="empty-state">Choose a bill from the register to open its invoice.</div>}
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
            {selectedBill?.item?.payments?.length ? <div className="stack-list" style={{ marginTop: 18 }}>{selectedBill.item.payments.map((payment) => (<div key={payment.id} className="quick-action"><strong>{payment.receiptNumber}</strong><div className="timeline-copy">Rs. {payment.amount} via {payment.paymentMode}</div><div className="timeline-copy">{payment.referenceNumber || "No reference"}</div><div className="timeline-copy">{payment.paymentDate}</div></div>))}</div> : <div className="empty-state" style={{ marginTop: 18 }}>No payments recorded for this bill yet.</div>}
          </article>
        </section>
      </section>
    </DashboardLayout>
  );
}
