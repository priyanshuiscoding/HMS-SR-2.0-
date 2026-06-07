import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
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
  const [statusFilter, setStatusFilter] = useState("pending");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const handleDispense = async () => {
    if (!selectedPrescription) {
      return;
    }

    try {
      await dispensePrescription(selectedPrescription.id, {
        items: selectedPrescription.medicines.map((item) => ({
          medicineId: item.medicineId,
          quantity: item.quantityDispensed
        }))
      });

      await loadAll(statusFilter);
      setMessage("Prescription dispensed and stock updated.");
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
      setSelectedPrescription(response.item);
      await loadAll(statusFilter);
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

    if (!["admin", "pharmacy"].includes(user?.role)) {
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
                </div>
                <div className="queue-actions">
                  <span className={`status-pill ${item.isDispensed ? "completed" : item.pharmacyStatus === "cancelled" ? "cancelled" : "waiting"}`}>
                    {item.pharmacyStatus || (item.isDispensed ? "dispensed" : "pending")}
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
                  selectedPrescription.isDispensed ||
                  !["admin", "pharmacy"].includes(user?.role)
                }
              >
                {selectedPrescription?.isDispensed ? "Already Dispensed" : "Dispense Prescription"}
              </Button>
              <div className="action-row">
                <Button variant="secondary" onClick={() => handlePrescriptionWorkflow("cancel", "cancel prescription")} disabled={!selectedPrescription || selectedPrescription.isDispensed}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={() => handlePrescriptionWorkflow("reopen", "reopen prescription")} disabled={!selectedPrescription || selectedPrescription.isDispensed}>
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
                    <div><strong>Dispense status:</strong> {selectedPrescription.pharmacyStatus || (selectedPrescription.isDispensed ? "Completed" : "Pending")}</div>
                    <div><strong>Visit:</strong> {selectedPrescription.visit?.opdNumber || "Linked OPD visit"}</div>
                    {!["admin", "pharmacy"].includes(user?.role) ? (
                      <div><strong>Access:</strong> View only</div>
                    ) : null}
                  </div>
                </article>

                <article className="content-card inset-card">
                  <h3>Medicine lines</h3>
                  <div className="stack-list">
                    {selectedPrescription.medicines.map((item) => (
                      <div key={item.id} className="quick-action">
                        <strong>{item.medicineName}</strong>
                        <div className="timeline-copy">
                          {item.dose} - {item.frequency} - {item.timing || "As advised"}
                        </div>
                        <div className="timeline-copy">Requested qty: {item.quantityDispensed}</div>
                      </div>
                    ))}
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
              <div className="field field-span-2"><Button type="submit" disabled={!["admin", "pharmacy"].includes(user?.role)}>Receive Pharmacy Stock</Button></div>
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
