import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { canPerformModuleAction } from "../../utils/accessModules.js";
import {
  dispensePrescription,
  getDispensations,
  getInventoryMasters,
  getPharmacyMasters,
  getPharmacyPrescriptions,
  getPharmacyStock,
  receiveInventoryStock,
  updatePrescriptionPharmacyWorkflow
} from "../../services/api.js";

function statusPillClass(pharmacyStatus) {
  if (pharmacyStatus === "completed") return "completed";
  if (pharmacyStatus === "cancelled") return "cancelled";
  if (pharmacyStatus === "partial" || pharmacyStatus === "reopened") return "in_progress";
  return "waiting";
}

const initialReceiveForm = {
  medicineId: "",
  supplierId: "",
  batchNumber: "",
  expiryDate: "",
  quantityReceived: "",
  purchasePrice: "",
  sellingPrice: "",
  note: ""
};

export function PharmacyPage() {
  const { user } = useAuth();
  const [stockPayload, setStockPayload] = useState({ items: [], alerts: { lowStock: [], expiringSoon: [], outOfStock: [] } });
  const [prescriptions, setPrescriptions] = useState([]);
  const [dispensations, setDispensations] = useState([]);
  const [inventoryMasters, setInventoryMasters] = useState({ medicines: [], suppliers: [] });
  const [receiveForm, setReceiveForm] = useState(initialReceiveForm);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [dispenseQuantities, setDispenseQuantities] = useState({});
  const [statusFilter, setStatusFilter] = useState("pending");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canManagePharmacy = canPerformModuleAction(user, "pharmacy", ["admin", "pharmacy"]);
  const canReopenPharmacy = canPerformModuleAction(user, "pharmacy", ["admin", "pharmacy", "doctor"]);

  async function loadAll(filter = statusFilter) {
    try {
      const [masters, inventoryMastersResponse, stock, queue, dispensed] = await Promise.all([
        getPharmacyMasters(),
        getInventoryMasters(),
        getPharmacyStock(),
        getPharmacyPrescriptions({ status: filter }),
        getDispensations()
      ]);

      setInventoryMasters(inventoryMastersResponse);
      setStockPayload(stock);
      setPrescriptions(queue.items);
      setDispensations(dispensed.items);
      setSelectedPrescription((current) =>
        queue.items.find((item) => item.id === current?.id) || queue.items[0] || null
      );
      setError("");
      setMessage(masters.alerts.lowStock.length ? "Low-stock alerts are active in sample pharmacy data." : "");
    } catch (apiError) {
      setError(apiError.message || "Unable to load pharmacy workspace.");
    }
  }

  useEffect(() => {
    loadAll("pending");
  }, []);

  // Default each line to whatever is still pending, so the common "give the rest
  // of the course" case is a single click while part-issues stay editable.
  useEffect(() => {
    setDispenseQuantities(
      Object.fromEntries((selectedPrescription?.medicines || []).map((item) => [item.id, String(item.balanceQuantity ?? 0)]))
    );
  }, [selectedPrescription?.id, selectedPrescription?.dispensedTotal]);

  const pharmacyStats = useMemo(() => {
    return {
      lowStock: stockPayload.alerts.lowStock.length,
      expiringSoon: stockPayload.alerts.expiringSoon.length,
      outOfStock: stockPayload.alerts.outOfStock.length,
      pendingRx: prescriptions.filter((item) => !item.isDispensed).length
    };
  }, [prescriptions, stockPayload]);

  const handleFilterChange = async (event) => {
    const nextFilter = event.target.value;
    setStatusFilter(nextFilter);
    await loadAll(nextFilter);
  };

  const handleDispenseQuantityChange = (medicineLineId, value) => {
    setDispenseQuantities((current) => ({ ...current, [medicineLineId]: value }));
  };

  const dispenseLines = useMemo(
    () =>
      (selectedPrescription?.medicines || [])
        .map((item) => ({ item, quantity: Number(dispenseQuantities[item.id] || 0) }))
        .filter((line) => line.quantity > 0),
    [selectedPrescription, dispenseQuantities]
  );

  // Reopen covers both a completed course the patient wants repeated and a
  // prescription that was cancelled by mistake.
  const canReopen =
    Boolean(selectedPrescription) &&
    (selectedPrescription.isDispensed || selectedPrescription.pharmacyStatus === "cancelled") &&
    canReopenPharmacy;

  const handleDispense = async () => {
    if (!selectedPrescription || !dispenseLines.length) {
      setError("Enter a dispense quantity for at least one medicine.");
      return;
    }

    try {
      const response = await dispensePrescription(selectedPrescription.id, {
        items: dispenseLines.map((line) => ({
          medicineId: line.item.medicineId,
          quantity: line.quantity
        }))
      });

      await loadAll(statusFilter);
      setMessage(
        response.item?.fullyDispensed
          ? `${response.item.dispenseNumber} dispensed in full. Charges are pending at the billing desk.`
          : `Part quantity dispensed as ${response.item?.dispenseNumber}. Balance stays in the pending queue, charges go to the billing desk.`
      );
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to dispense prescription.");
    }
  };

  const handlePrescriptionWorkflow = async (action, label = action) => {
    if (!selectedPrescription) {
      return;
    }

    const reason = window.prompt(`Reason for ${label}:`);
    if (!reason?.trim()) {
      setError("Reason is required for pharmacy workflow actions.");
      return;
    }

    try {
      const response = await updatePrescriptionPharmacyWorkflow(selectedPrescription.id, { action, reason });
      // A reopened prescription goes back to the pending queue, so follow it there.
      const nextFilter = action === "reopen" ? "pending" : statusFilter;
      setStatusFilter(nextFilter);
      setSelectedPrescription(response.item);
      await loadAll(nextFilter);
      setMessage(response.message);
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to update pharmacy workflow.");
    }
  };

  const handleReceiveChange = (event) => {
    setReceiveForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const updateReceiveField = (name, value) => {
    setReceiveForm((current) => ({ ...current, [name]: value }));
  };

  const handleReceiveStock = async (event) => {
    event.preventDefault();

    if (!canManagePharmacy) {
      setError("Only admin and pharmacy users can receive pharmacy stock.");
      return;
    }

    try {
      const response = await receiveInventoryStock(receiveForm);
      setReceiveForm(initialReceiveForm);
      setMessage(response.message || "Pharmacy stock received.");
      setError("");
      await loadAll(statusFilter);
    } catch (apiError) {
      setError(apiError.message || "Unable to receive pharmacy stock.");
    }
  };

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">Pharmacy Workspace</div>
        <h2>Prescription dispensing, stock alerts, and medicine movement in one operational view.</h2>
        <p>
          This phase links OPD prescriptions to pharmacy execution, so the team can review pending
          prescriptions, dispense against stock batches, and monitor medicine availability before go-live.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card">
          <div className="stat-label">Pending Rx</div>
          <div className="stat-value">{pharmacyStats.pendingRx}</div>
          <div className="stat-note">Prescription queue ready</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Low Stock</div>
          <div className="stat-value">{pharmacyStats.lowStock}</div>
          <div className="stat-note">Needs replenishment soon</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Expiring Soon</div>
          <div className="stat-value">{pharmacyStats.expiringSoon}</div>
          <div className="stat-note">Batch attention required</div>
        </article>
        <article className="stat-card">
          <div className="stat-label">Out Of Stock</div>
          <div className="stat-value">{pharmacyStats.outOfStock}</div>
          <div className="stat-note">Cannot dispense directly</div>
        </article>
      </section>

      <section className="opd-grid">
        <aside className="content-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Prescription Queue</div>
              <h3>Pending and completed prescriptions</h3>
            </div>
          </div>

          <div className="toolbar">
            <select value={statusFilter} onChange={handleFilterChange}>
              <option value="pending">Pending dispensing</option>
              <option value="completed">Completed dispensing</option>
              <option value="cancelled">Cancelled prescriptions</option>
              <option value="">All prescriptions</option>
            </select>
          </div>

          <div className="queue-list">
            {prescriptions.map((item) => (
              <div
                key={item.id}
                className={`queue-item selectable-card${selectedPrescription?.id === item.id ? " selected-card" : ""}`}
                onClick={() => setSelectedPrescription(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setSelectedPrescription(item);
                  }
                }}
              >
                <div>
                  <strong>{item.prescriptionNumber}</strong>
                  <div className="timeline-copy">{item.patientName}</div>
                  <div className="timeline-copy">{item.diagnosis}</div>
                  <div className="timeline-copy">{item.prescriptionDate}</div>
                  {item.balanceTotal > 0 && item.dispensedTotal > 0 ? (
                    <div className="timeline-copy">Balance pending: {item.balanceTotal}</div>
                  ) : null}
                </div>
                <div className="queue-actions">
                  <span className={`status-pill ${statusPillClass(item.pharmacyStatus)}`}>
                    {item.pharmacyStatus}
                  </span>
                </div>
              </div>
            ))}

            {!prescriptions.length ? <div className="empty-state">No prescriptions found for this filter.</div> : null}
          </div>
        </aside>

        <section className="consultation-column">
          <article className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Dispensing Desk</div>
                <h3>{selectedPrescription?.patientName || "Select a prescription"}</h3>
              </div>
              <Button
                onClick={handleDispense}
                disabled={
                  !selectedPrescription ||
                  selectedPrescription.pharmacyStatus === "cancelled" ||
                  !dispenseLines.length ||
                  !canManagePharmacy
                }
              >
                {selectedPrescription?.isDispensed ? "Dispense Again" : "Dispense Medicine"}
              </Button>
              <div className="action-row">
                <Button variant="secondary" onClick={() => handlePrescriptionWorkflow("cancel", "cancel prescription")} disabled={!selectedPrescription || selectedPrescription.isDispensed}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handlePrescriptionWorkflow("reopen", "reopen prescription")}
                  disabled={!selectedPrescription || !canReopen}
                >
                  Reopen
                </Button>
              </div>
            </div>

            {error ? <div className="error-text">{error}</div> : null}
            {message ? <div className="success-text">{message}</div> : null}

            {selectedPrescription ? (
              <div className="detail-grid">
                <article className="content-card inset-card">
                  <h3>Prescription detail</h3>
                  <div className="detail-list">
                    <div><strong>Prescription:</strong> {selectedPrescription.prescriptionNumber}</div>
                    <div><strong>Diagnosis:</strong> {selectedPrescription.diagnosis}</div>
                    <div><strong>Dispense status:</strong> {selectedPrescription.pharmacyStatus}</div>
                    <div><strong>Prescribed / given / balance:</strong> {selectedPrescription.prescribedTotal} / {selectedPrescription.dispensedTotal} / {selectedPrescription.balanceTotal}</div>
                    <div><strong>Visit:</strong> {selectedPrescription.visit?.opdNumber || "Linked OPD visit"}</div>
                    {!canManagePharmacy ? (
                      <div><strong>Access:</strong> View only</div>
                    ) : null}
                  </div>
                </article>

                <article className="content-card inset-card">
                  <h3>Medicine lines</h3>
                  <div className="stack-list">
                    {selectedPrescription.medicines.map((item) => {
                      const quantity = Number(dispenseQuantities[item.id] || 0);

                      return (
                        <div key={item.id} className="quick-action">
                          <strong>{item.medicineName}</strong>
                          <div className="timeline-copy">
                            {item.dose} - {item.frequency} - {item.timing || "As advised"}
                          </div>
                          <div className="timeline-copy">
                            Prescribed {item.quantityPrescribed} | Given {item.quantityIssued} | Balance {item.balanceQuantity}
                          </div>
                          <div className="field">
                            <label>Dispense now</label>
                            <input
                              value={dispenseQuantities[item.id] ?? ""}
                              onChange={(event) => handleDispenseQuantityChange(item.id, event.target.value)}
                              disabled={!canManagePharmacy}
                            />
                          </div>
                          {quantity > item.balanceQuantity ? (
                            <div className="timeline-copy">Above the prescribed balance ({item.balanceQuantity}).</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="content-card inset-card">
                  <h3>Dispense history</h3>
                  <div className="stack-list">
                    {(selectedPrescription.dispensations || []).map((dispensation) => (
                      <div key={dispensation.id} className="quick-action">
                        <strong>{dispensation.dispenseNumber}</strong>
                        <div className="timeline-copy">{dispensation.dispensedDate}</div>
                        <div className="timeline-copy">
                          {dispensation.items.map((line) => `${line.medicineName} x${line.quantity}`).join(", ")}
                        </div>
                        <div className="timeline-copy">Bill: {dispensation.metadata?.billNumber || "Not billed"}</div>
                      </div>
                    ))}
                    {!selectedPrescription.dispensations?.length ? (
                      <div className="empty-state">Nothing dispensed against this prescription yet.</div>
                    ) : null}
                  </div>
                </article>
              </div>
            ) : (
              <div className="empty-state">Choose a prescription from the queue to see its dispense detail.</div>
            )}
          </article>

          <article className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Stock Alerts</div>
                <h3>Pharmacy medicine availability</h3>
              </div>
            </div>

            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Available</th>
                    <th>Reorder</th>
                    <th>Nearest expiry</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {stockPayload.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <div className="muted-text">{item.formulation} - {item.category}</div>
                      </td>
                      <td>{item.totalAvailable} {item.unit}</td>
                      <td>{item.reorderLevel}</td>
                      <td>{item.nearestExpiry || "No batch"}</td>
                      <td>
                        <div className="badge-row">
                          {item.lowStock ? <span className="alert-badge warning">Low stock</span> : null}
                          {item.expiringSoon ? <span className="alert-badge">Expiring</span> : null}
                          {!item.totalAvailable ? <span className="alert-badge danger">Out</span> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Receive Stock</div>
                <h3>Add medicine batch to pharmacy</h3>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleReceiveStock}>
              <div className="field field-span-2">
                <label>Medicine</label>
                <SearchableSelect
                  value={receiveForm.medicineId}
                  options={inventoryMasters.medicines}
                  onChange={(value) => updateReceiveField("medicineId", value)}
                  placeholder="Search medicine"
                  emptyLabel="No matching medicine"
                  getOptionLabel={(item) => item.name}
                  getOptionMeta={(item) => `${item.formulation || ""} ${item.category || ""}`.trim()}
                  getSearchText={(item) => [item.name, item.formulation, item.category, item.unit].filter(Boolean).join(" ")}
                />
              </div>
              <div className="field">
                <label>Supplier</label>
                <SearchableSelect
                  value={receiveForm.supplierId}
                  options={inventoryMasters.suppliers}
                  onChange={(value) => updateReceiveField("supplierId", value)}
                  placeholder="Search supplier"
                  emptyLabel="No matching supplier"
                  getOptionLabel={(item) => item.name}
                />
              </div>
              <div className="field"><label>Batch number</label><input name="batchNumber" value={receiveForm.batchNumber} onChange={handleReceiveChange} /></div>
              <div className="field"><label>Expiry date</label><input type="date" name="expiryDate" value={receiveForm.expiryDate} onChange={handleReceiveChange} /></div>
              <div className="field"><label>Quantity</label><input name="quantityReceived" value={receiveForm.quantityReceived} onChange={handleReceiveChange} /></div>
              <div className="field"><label>Purchase price</label><input name="purchasePrice" value={receiveForm.purchasePrice} onChange={handleReceiveChange} /></div>
              <div className="field"><label>Selling price</label><input name="sellingPrice" value={receiveForm.sellingPrice} onChange={handleReceiveChange} /></div>
              <div className="field field-span-2"><label>Note</label><input name="note" value={receiveForm.note} onChange={handleReceiveChange} /></div>
              <div className="field field-span-2"><Button type="submit" disabled={!canManagePharmacy}>Receive Pharmacy Stock</Button></div>
            </form>
          </article>

          <article className="content-card">
            <div className="section-header">
              <div>
                <div className="eyebrow">Recent Dispensing</div>
                <h3>Pharmacy completion history</h3>
              </div>
            </div>

            <div className="stack-list">
              {dispensations.map((item) => (
                <div key={item.id} className="quick-action">
                  <strong>{item.dispenseNumber}</strong>
                  <div className="timeline-copy">{item.patientName}</div>
                  <div className="timeline-copy">
                    {item.items.map((line) => `${line.medicineName} x${line.quantity}`).join(", ")}
                  </div>
                  <div className="timeline-copy">{item.dispensedDate}</div>
                </div>
              ))}
              {!dispensations.length ? <div className="empty-state">No dispensing activity recorded yet.</div> : null}
            </div>
          </article>
        </section>
      </section>
    </DashboardLayout>
  );
}
