import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  adjustHospitalInventoryStock,
  createHospitalInventoryItem,
  getHospitalInventoryItems,
  getHospitalInventoryTransactions,
  getInventoryMasters
} from "../../services/api.js";

const initialItemForm = {
  name: "",
  category: "General",
  department: "Hospital Store",
  unit: "unit",
  openingQuantity: "",
  reorderLevel: "",
  location: "",
  supplierId: "",
  purchasePrice: "",
  notes: ""
};

const initialStockForm = {
  itemId: "",
  type: "receipt",
  quantity: "",
  referenceNumber: "",
  department: "Hospital Store",
  note: ""
};

export function InventoryPage() {
  const { user } = useAuth();
  const [masters, setMasters] = useState({ suppliers: [] });
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [stockForm, setStockForm] = useState(initialStockForm);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canManage = ["admin", "accounts"].includes(user?.role);
  const canMoveStock = ["admin", "accounts", "nursing"].includes(user?.role);

  async function loadAll(searchValue = search) {
    try {
      const [mastersResponse, itemsResponse, transactionsResponse] = await Promise.all([
        getInventoryMasters(),
        getHospitalInventoryItems(searchValue ? { search: searchValue } : {}),
        getHospitalInventoryTransactions()
      ]);

      setMasters(mastersResponse);
      setItems(itemsResponse.items);
      setTransactions(transactionsResponse.items);
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load hospital inventory.");
    }
  }

  useEffect(() => {
    loadAll("");
  }, []);

  const stats = useMemo(() => ({
    items: items.length,
    lowStock: items.filter((item) => item.lowStock).length,
    departments: new Set(items.map((item) => item.department).filter(Boolean)).size,
    receipts: transactions.filter((item) => item.type === "receipt").length,
    issues: transactions.filter((item) => item.type === "issue").length
  }), [items, transactions]);

  const handleItemChange = (event) => {
    setItemForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleStockChange = (event) => {
    setStockForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    await loadAll(search);
  };

  const handleCreateItem = async (event) => {
    event.preventDefault();
    if (!canManage) {
      setError("Only admin and accounts users can create hospital inventory items.");
      return;
    }

    try {
      const response = await createHospitalInventoryItem(itemForm);
      setMessage(response.message);
      setItemForm(initialItemForm);
      await loadAll();
    } catch (apiError) {
      setError(apiError.message || "Unable to create hospital inventory item.");
    }
  };

  const handleAdjustStock = async (event) => {
    event.preventDefault();
    if (!canMoveStock) {
      setError("Only admin, accounts, and nursing users can move hospital inventory stock.");
      return;
    }

    try {
      const response = await adjustHospitalInventoryStock(stockForm);
      setMessage(response.message);
      setStockForm(initialStockForm);
      await loadAll();
    } catch (apiError) {
      setError(apiError.message || "Unable to update hospital inventory stock.");
    }
  };

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">Hospital Inventory</div>
        <h2>General hospital store for non-pharmacy items, assets, consumables, and department stock.</h2>
        <p>
          Medicines and medicine batches now stay in Pharmacy. This inventory area is reserved for the wider hospital
          list you will share later: linen, disposables, equipment, housekeeping, office, ward, and department items.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card"><div className="stat-label">Items</div><div className="stat-value">{stats.items}</div><div className="stat-note">Hospital store records</div></article>
        <article className="stat-card"><div className="stat-label">Low Stock</div><div className="stat-value">{stats.lowStock}</div><div className="stat-note">Below reorder level</div></article>
        <article className="stat-card"><div className="stat-label">Departments</div><div className="stat-value">{stats.departments}</div><div className="stat-note">Using stock</div></article>
        <article className="stat-card"><div className="stat-label">Receipts</div><div className="stat-value">{stats.receipts}</div><div className="stat-note">Hospital inventory in</div></article>
        <article className="stat-card"><div className="stat-label">Issues</div><div className="stat-value">{stats.issues}</div><div className="stat-note">Hospital inventory out</div></article>
      </section>

      <section className="content-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Create Item</div><h3>Add hospital inventory item</h3></div></div>

          {error ? <div className="error-text">{error}</div> : null}
          {message ? <div className="success-text">{message}</div> : null}

          <form className="form-grid" onSubmit={handleCreateItem}>
            <div className="field field-span-2"><label>Item name</label><input name="name" value={itemForm.name} onChange={handleItemChange} /></div>
            <div className="field"><label>Category</label><input name="category" value={itemForm.category} onChange={handleItemChange} placeholder="Linen, Housekeeping, Equipment" /></div>
            <div className="field"><label>Department</label><input name="department" value={itemForm.department} onChange={handleItemChange} /></div>
            <div className="field"><label>Unit</label><input name="unit" value={itemForm.unit} onChange={handleItemChange} /></div>
            <div className="field"><label>Opening quantity</label><input name="openingQuantity" value={itemForm.openingQuantity} onChange={handleItemChange} /></div>
            <div className="field"><label>Reorder level</label><input name="reorderLevel" value={itemForm.reorderLevel} onChange={handleItemChange} /></div>
            <div className="field"><label>Location</label><input name="location" value={itemForm.location} onChange={handleItemChange} /></div>
            <div className="field"><label>Supplier</label><select name="supplierId" value={itemForm.supplierId} onChange={handleItemChange}><option value="">No supplier</option>{masters.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
            <div className="field"><label>Purchase price</label><input name="purchasePrice" value={itemForm.purchasePrice} onChange={handleItemChange} /></div>
            <div className="field field-span-2"><label>Notes</label><input name="notes" value={itemForm.notes} onChange={handleItemChange} /></div>
            <div className="field field-span-2"><Button type="submit" disabled={!canManage}>Create Item</Button></div>
          </form>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Stock Movement</div><h3>Receive, issue, or adjust</h3></div></div>
          <form className="form-grid" onSubmit={handleAdjustStock}>
            <div className="field field-span-2"><label>Item</label><select name="itemId" value={stockForm.itemId} onChange={handleStockChange}><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.itemCode} - {item.name}</option>)}</select></div>
            <div className="field"><label>Type</label><select name="type" value={stockForm.type} onChange={handleStockChange}><option value="receipt">Receipt</option><option value="issue">Issue</option><option value="adjustment">Adjustment +</option></select></div>
            <div className="field"><label>Quantity</label><input name="quantity" value={stockForm.quantity} onChange={handleStockChange} /></div>
            <div className="field"><label>Department</label><input name="department" value={stockForm.department} onChange={handleStockChange} /></div>
            <div className="field"><label>Reference</label><input name="referenceNumber" value={stockForm.referenceNumber} onChange={handleStockChange} /></div>
            <div className="field field-span-2"><label>Note</label><input name="note" value={stockForm.note} onChange={handleStockChange} /></div>
            <div className="field field-span-2"><Button type="submit" disabled={!canMoveStock}>Update Stock</Button></div>
          </form>

          <div className="empty-state" style={{ marginTop: 16 }}>
            Pharmacy medicines are intentionally not shown here. Use Pharmacy for medicine stock and dispensing.
          </div>
        </article>
      </section>

      <section className="content-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Hospital Store</div><h3>Current inventory items</h3></div></div>
          <form className="toolbar" onSubmit={handleSearchSubmit}>
            <input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, category, department, location" />
            <Button type="submit">Search</Button>
          </form>

          <div className="table-shell">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Department</th><th>Available</th><th>Reorder</th><th>Location</th><th>Flag</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.itemCode}</td>
                    <td><strong>{item.name}</strong><div className="muted-text">{item.notes || "-"}</div></td>
                    <td>{item.category}</td>
                    <td>{item.department}</td>
                    <td>{item.quantityAvailable} {item.unit}</td>
                    <td>{item.reorderLevel}</td>
                    <td>{item.location || "-"}</td>
                    <td>{item.lowStock ? <span className="alert-badge warning">Low</span> : <span className="alert-badge">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length ? <div className="empty-state">No hospital inventory items added yet.</div> : null}
          </div>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Movement History</div><h3>Hospital inventory ledger</h3></div></div>
          <div className="stack-list">
            {transactions.map((item) => (
              <div key={item.id} className="quick-action">
                <strong>{item.itemName}</strong>
                <div className="timeline-copy">{item.type} - {item.quantity > 0 ? `+${item.quantity}` : item.quantity}</div>
                <div className="timeline-copy">{item.department || "No department"} | {item.referenceNumber || "No reference"}</div>
                <div className="timeline-copy">{item.transactionDate}</div>
              </div>
            ))}
            {!transactions.length ? <div className="empty-state">No hospital inventory movements yet.</div> : null}
          </div>
        </article>
      </section>
    </DashboardLayout>
  );
}
