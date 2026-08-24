import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { canPerformModuleAction } from "../../utils/accessModules.js";
import { formatCurrency } from "../../utils/format.js";
import {
  collectLabSample,
  getLabOrder,
  getLabOrders,
  getLabSummary,
  getLabTests,
  saveLabResults,
  updateLabOrderWorkflow
} from "../../services/api.js";

const today = new Date().toISOString().slice(0, 10);

const initialSampleForm = {
  sampleType: "blood",
  sampleCollectionTime: "",
  collectionNote: ""
};

export function LaboratoryPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [masters, setMasters] = useState({ tests: [], priorities: [], statuses: [], resultFlags: [] });
  const [filters, setFilters] = useState({ orderDate: today, status: "", priority: "", search: "" });
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sampleForm, setSampleForm] = useState(initialSampleForm);
  const [resultForm, setResultForm] = useState({ processingSummary: "", markReported: false, tests: [] });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAll(nextFilters = filters, selectedId = selectedOrder?.id) {
    try {
      const [summaryResponse, mastersResponse, ordersResponse] = await Promise.all([
        getLabSummary(),
        getLabTests(),
        getLabOrders(nextFilters)
      ]);

      setSummary(summaryResponse);
      setMasters(mastersResponse);
      setOrders(ordersResponse.items);

      const activeId = selectedId || ordersResponse.items[0]?.id;
      if (activeId) {
        const detail = await getLabOrder(activeId);
        setSelectedOrder(detail);
        setSampleForm({
          sampleType: detail.sampleType || "blood",
          sampleCollectionTime: detail.sampleCollectionTime || "",
          collectionNote: detail.collectionNote || ""
        });
        setResultForm({
          processingSummary: detail.processingSummary || "",
          markReported: detail.status === "reported",
          tests: detail.tests.map((test) => ({
            testId: test.testId,
            result: test.result || "",
            remarks: test.remarks || "",
            resultFlag: test.resultFlag || "normal"
          }))
        });
      } else {
        setSelectedOrder(null);
      }

      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load laboratory workspace.");
    }
  }

  useEffect(() => {
    loadAll({ orderDate: today, status: "", priority: "", search: "" });
  }, []);

  const stats = summary || {
    totalOrders: 0,
    todayOrders: 0,
    pendingOrders: 0,
    collectedOrders: 0,
    processingOrders: 0,
    reportedOrders: 0,
    pendingBilling: 0
  };

  const canCollectSamples = canPerformModuleAction(user, "lab", ["admin", "lab", "reception", "doctor"]);
  const canSaveResults = canPerformModuleAction(user, "lab", ["admin", "lab", "doctor"]);

  const selectedOrderCharge = useMemo(() => {
    return selectedOrder?.tests?.reduce((sum, test) => {
      const master = masters.tests.find((entry) => entry.id === test.testId);
      return sum + Number(master?.price || 0);
    }, 0) || 0;
  }, [masters.tests, selectedOrder]);

  const handleFilterChange = async (event) => {
    const nextFilters = { ...filters, [event.target.name]: event.target.value };
    setFilters(nextFilters);
    await loadAll(nextFilters);
  };

  const openOrder = async (orderId) => {
    try {
      const detail = await getLabOrder(orderId);
      setSelectedOrder(detail);
      setSampleForm({
        sampleType: detail.sampleType || "blood",
        sampleCollectionTime: detail.sampleCollectionTime || "",
        collectionNote: detail.collectionNote || ""
      });
      setResultForm({
        processingSummary: detail.processingSummary || "",
        markReported: detail.status === "reported",
        tests: detail.tests.map((test) => ({
          testId: test.testId,
          result: test.result || "",
          remarks: test.remarks || "",
          resultFlag: test.resultFlag || "normal"
        }))
      });
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load lab order.");
    }
  };

  const handleSampleChange = (event) => {
    setSampleForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleCollectSample = async (event) => {
    event.preventDefault();
    if (!selectedOrder?.id) {
      return;
    }
    if (!canCollectSamples) {
      setError("You do not have permission to collect samples.");
      return;
    }

    try {
      const response = await collectLabSample(selectedOrder.id, sampleForm);
      setMessage(response.message);
      await loadAll(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to collect sample.");
    }
  };

  const handleResultChange = (index, field, value) => {
    setResultForm((current) => {
      const tests = [...current.tests];
      tests[index] = { ...tests[index], [field]: value };
      return { ...current, tests };
    });
  };

  const handleResultsMetaChange = (event) => {
    const { name, value, type, checked } = event.target;
    setResultForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSaveResults = async (event) => {
    event.preventDefault();
    if (!selectedOrder?.id) {
      return;
    }
    if (!canSaveResults) {
      setError("You do not have permission to save lab results.");
      return;
    }

    try {
      const response = await saveLabResults(selectedOrder.id, resultForm);
      setMessage(response.message);
      await loadAll(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to save lab results.");
    }
  };

  const handleWorkflowAction = async (action, label = action) => {
    if (!selectedOrder?.id) {
      return;
    }

    const reason = window.prompt(`Reason for ${label}:`);
    if (!reason?.trim()) {
      setError("Reason is required for lab workflow actions.");
      return;
    }

    try {
      const response = await updateLabOrderWorkflow(selectedOrder.id, { action, reason });
      setMessage(response.message);
      await loadAll(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to update lab workflow.");
    }
  };

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">Laboratory</div>
        <h2>Manage orders, sample collection, results, and printable reports from one lab desk.</h2>
        <p>
          This phase completes the lab workflow with a daily order board, result entry, report-ready review, and
          billing linkage so investigations can move cleanly from clinical order to financial closure.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card"><div className="stat-label">Today</div><div className="stat-value">{stats.todayOrders}</div><div className="stat-note">Orders raised today</div></article>
        <article className="stat-card"><div className="stat-label">Pending</div><div className="stat-value">{stats.pendingOrders}</div><div className="stat-note">Awaiting collection</div></article>
        <article className="stat-card"><div className="stat-label">Processing</div><div className="stat-value">{stats.processingOrders}</div><div className="stat-note">Results in progress</div></article>
        <article className="stat-card"><div className="stat-label">Pending Billing</div><div className="stat-value">{stats.pendingBilling}</div><div className="stat-note">Reported but not billed</div></article>
      </section>

      <section className="workspace-grid">
        <article className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Lab Register</div>
              <h3>Order board</h3>
            </div>
          </div>

          <div className="toolbar">
            <input className="search-input" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search by order, patient, or test" />
            <input type="date" name="orderDate" value={filters.orderDate} onChange={handleFilterChange} />
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All statuses</option>
              {masters.statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select name="priority" value={filters.priority} onChange={handleFilterChange}>
              <option value="">All priorities</option>
              {masters.priorities.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>

          <div className="queue-list">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`queue-item selectable-card${selectedOrder?.id === order.id ? " selected-card" : ""}`}
                onClick={() => openOrder(order.id)}
                role="button"
                tabIndex={0}
              >
                <div>
                  <strong>{order.orderNumber}</strong>
                  <div className="timeline-copy">{order.patientName}</div>
                  <div className="timeline-copy">{order.tests.map((test) => test.testName).join(", ")}</div>
                  <div className="timeline-copy">{order.orderDate} | {order.priority}</div>
                </div>
                <div className="queue-actions">
                  <span className={`status-pill ${order.status === "reported" ? "completed" : order.status === "processing" ? "in_progress" : "waiting"}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
            {!orders.length ? <div className="empty-state">No lab orders found for the selected filter.</div> : null}
          </div>
        </article>

        <article className="content-card printable-area">
          <div className="section-header no-print">
            <div>
              <div className="eyebrow">Report View</div>
              <h3>{selectedOrder?.orderNumber || "Select a lab order"}</h3>
            </div>
            <div className="action-row">
              <Button variant="secondary" onClick={() => handleWorkflowAction("cancel", "cancel lab order")} disabled={!selectedOrder}>Cancel</Button>
              <Button variant="secondary" onClick={() => handleWorkflowAction("reopen", "reopen lab order")} disabled={!selectedOrder}>Reopen</Button>
              <Button variant="secondary" onClick={() => handleWorkflowAction("requeue", "requeue lab order")} disabled={!selectedOrder}>Requeue</Button>
              <Button variant="secondary" onClick={() => window.print()} disabled={!selectedOrder}>Print Report</Button>
            </div>
          </div>

          {error ? <div className="error-text no-print">{error}</div> : null}
          {message ? <div className="success-text no-print">{message}</div> : null}

          {selectedOrder ? (
            <div className="invoice-sheet">
              <div className="invoice-header">
                <div>
                  <div className="eyebrow">SR-AIIMS Laboratory</div>
                  <h3>Lab Investigation Report</h3>
                  <div className="timeline-copy">Order {selectedOrder.orderNumber}</div>
                </div>
                <div className="detail-list compact-detail">
                  <div><strong>Date:</strong> {selectedOrder.orderDate}</div>
                  <div><strong>Status:</strong> {selectedOrder.status}</div>
                  <div><strong>Priority:</strong> {selectedOrder.priority}</div>
                </div>
              </div>

              <div className="detail-grid">
                <article className="content-card inset-card">
                  <h3>Patient</h3>
                  <div className="detail-list">
                    <div><strong>Name:</strong> {selectedOrder.patientName}</div>
                    <div><strong>UHID:</strong> {selectedOrder.patient?.uhid || "N/A"}</div>
                    <div><strong>Phone:</strong> {selectedOrder.patient?.phone || "N/A"}</div>
                    <div><strong>Visit:</strong> {selectedOrder.visit?.opdNumber || "Standalone order"}</div>
                  </div>
                </article>
                <article className="content-card inset-card">
                  <h3>Processing</h3>
                  <div className="detail-list">
                    <div><strong>Sample:</strong> {selectedOrder.sampleType || "Not captured"}</div>
                    <div><strong>Collected:</strong> {selectedOrder.sampleCollectionTime || "Pending"}</div>
                    <div><strong>Reported:</strong> {selectedOrder.reportedAt || "Pending"}</div>
                    <div><strong>Bill:</strong> {selectedOrder.bill?.billNumber || "Not generated"}</div>
                  </div>
                </article>
              </div>

              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Normal Range</th>
                      <th>Result</th>
                      <th>Flag</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.tests.map((test) => (
                      <tr key={test.id}>
                        <td>{test.testName}</td>
                        <td>{test.normalRange || "-"}</td>
                        <td>{test.result || "-"}</td>
                        <td>{test.resultFlag || "-"}</td>
                        <td>{test.remarks || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedOrder.processingSummary ? (
                <div className="content-card inset-card">
                  <h3>Lab Summary</h3>
                  <div className="timeline-copy">{selectedOrder.processingSummary}</div>
                </div>
              ) : null}
            </div>
          ) : <div className="empty-state">Choose a lab order from the register to review its report.</div>}
        </article>
      </section>

      <section className="opd-grid">
        <article className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Sample Collection</div>
              <h3>Capture collection detail</h3>
            </div>
          </div>

          {!selectedOrder ? (
            <div className="empty-state">Select a lab order to collect a sample.</div>
          ) : (
            <form className="form-grid" onSubmit={handleCollectSample}>
              <div className="field">
                <label>Sample type</label>
                <select name="sampleType" value={sampleForm.sampleType} onChange={handleSampleChange}>
                  <option value="blood">blood</option>
                  <option value="urine">urine</option>
                  <option value="serum">serum</option>
                  <option value="stool">stool</option>
                  <option value="swab">swab</option>
                </select>
              </div>
              <div className="field">
                <label>Collection time</label>
                <input name="sampleCollectionTime" value={sampleForm.sampleCollectionTime} onChange={handleSampleChange} placeholder="Leave blank for current time" />
              </div>
              <div className="field field-span-2">
                <label>Collection note</label>
                <input name="collectionNote" value={sampleForm.collectionNote} onChange={handleSampleChange} />
              </div>
              <div className="field field-span-2">
                <Button type="submit" disabled={!canCollectSamples}>Collect Sample</Button>
              </div>
            </form>
          )}
        </article>

        <section className="consultation-column">
          <article className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Result Entry</div>
                <h3>Record results and report</h3>
              </div>
            </div>

            {!selectedOrder ? (
              <div className="empty-state">Select a lab order to enter results.</div>
            ) : (
              <form className="form-grid" onSubmit={handleSaveResults}>
                <div className="field field-span-2">
                  <label>Processing summary</label>
                  <input name="processingSummary" value={resultForm.processingSummary} onChange={handleResultsMetaChange} />
                </div>
                <label className="checkbox-chip field-span-2">
                  <input type="checkbox" name="markReported" checked={resultForm.markReported} onChange={handleResultsMetaChange} />
                  <span>Mark as final reported</span>
                </label>
                <div className="field field-span-2">
                  <label>Test results</label>
                  <div className="medicine-stack">
                    {resultForm.tests.map((test, index) => {
                      const master = selectedOrder.tests.find((entry) => entry.testId === test.testId);
                      return (
                        <div key={test.testId} className="medicine-card">
                          <div className="form-grid">
                            <div className="field field-span-2">
                              <label>{master?.testName || "Test"}</label>
                              <input value={test.result} onChange={(event) => handleResultChange(index, "result", event.target.value)} />
                            </div>
                            <div className="field">
                              <label>Flag</label>
                              <select value={test.resultFlag} onChange={(event) => handleResultChange(index, "resultFlag", event.target.value)}>
                                {masters.resultFlags.map((flag) => (
                                  <option key={flag} value={flag}>{flag}</option>
                                ))}
                              </select>
                            </div>
                            <div className="field field-span-2">
                              <label>Remarks</label>
                              <input value={test.remarks} onChange={(event) => handleResultChange(index, "remarks", event.target.value)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="field field-span-2">
                  <Button type="submit" disabled={!canSaveResults}>Save Results</Button>
                </div>
              </form>
            )}
          </article>

          <article className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Billing Link</div>
                <h3>Investigation charges</h3>
              </div>
            </div>

            {!selectedOrder ? (
              <div className="empty-state">Select a lab order to create a bill.</div>
            ) : (
              <div className="detail-list">
                <div><strong>Investigation total:</strong> Rs. {formatCurrency(selectedOrderCharge)}</div>
                <div><strong>Bill:</strong> {selectedOrder.bill?.billNumber || "Pending at billing desk"}</div>
                <div className="empty-state">
                  Lab charges are billed at the Billing Desk along with the rest of the patient's visit.
                </div>
              </div>
            )}
          </article>
        </section>
      </section>
    </DashboardLayout>
  );
}
