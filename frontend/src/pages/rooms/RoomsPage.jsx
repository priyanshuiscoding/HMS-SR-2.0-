import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import {
  assignRoomBed,
  createRoom,
  dischargeRoomBed,
  getPatients,
  getRoom,
  getRoomMasters,
  getRooms,
  getRoomsAvailability
} from "../../services/api.js";

const initialRoomForm = {
  roomNumber: "",
  ward: "General Ward",
  roomType: "general",
  floor: "Ground Floor",
  bedCount: 1,
  bedPrefix: "Bed",
  chargePerDay: "",
  nursingStation: "Main Ward",
  notes: ""
};

const initialAssignForm = {
  patientId: "",
  admissionType: "observation",
  expectedDischargeDate: "",
  note: ""
};

const initialDischargeForm = {
  nextStatus: "cleaning",
  note: ""
};

export function RoomsPage() {
  const [availability, setAvailability] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [patients, setPatients] = useState([]);
  const [masters, setMasters] = useState({ roomTypes: [], bedStatuses: [], floors: [], wards: [], roomStatuses: [] });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedBed, setSelectedBed] = useState(null);
  const [filters, setFilters] = useState({ roomType: "", status: "" });
  const [roomForm, setRoomForm] = useState(initialRoomForm);
  const [assignForm, setAssignForm] = useState(initialAssignForm);
  const [dischargeForm, setDischargeForm] = useState(initialDischargeForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData(nextFilters = filters, selectedId = selectedRoom?.item?.id) {
    try {
      const [availabilityResponse, roomsResponse, mastersResponse, patientsResponse] = await Promise.all([
        getRoomsAvailability(),
        getRooms(nextFilters),
        getRoomMasters(),
        getPatients()
      ]);

      setAvailability(availabilityResponse);
      setRooms(roomsResponse.items);
      setMasters(mastersResponse);
      setPatients(patientsResponse.items);

      const activeRoomId = selectedId || roomsResponse.items[0]?.id;

      if (activeRoomId) {
        const detail = await getRoom(activeRoomId);
        setSelectedRoom(detail);
      } else {
        setSelectedRoom(null);
      }
    } catch (apiError) {
      setError(apiError.message || "Unable to load rooms and beds.");
    }
  }

  useEffect(() => {
    loadData({ roomType: "", status: "" });
  }, []);

  const stats = useMemo(() => availability?.summary || {
    totalRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    reservedBeds: 0,
    blockedBeds: 0
  }, [availability]);

  const handleRoomFormChange = (event) => {
    setRoomForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleAssignFormChange = (event) => {
    setAssignForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleAssignPatientChange = (patientId) => {
    setAssignForm((current) => ({ ...current, patientId }));
  };

  const handleDischargeFormChange = (event) => {
    setDischargeForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleFilterChange = async (event) => {
    const nextFilters = { ...filters, [event.target.name]: event.target.value };
    setFilters(nextFilters);
    await loadData(nextFilters);
  };

  const openRoom = async (roomId) => {
    try {
      const detail = await getRoom(roomId);
      setSelectedRoom(detail);
      setSelectedBed(null);
      setError("");
    } catch (apiError) {
      setError(apiError.message || "Unable to load room details.");
    }
  };

  const handleCreateRoom = async (event) => {
    event.preventDefault();

    try {
      const response = await createRoom(roomForm);
      setMessage(response.message);
      setRoomForm(initialRoomForm);
      await loadData(filters, response.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to create room.");
    }
  };

  const selectBed = (bed) => {
    setSelectedBed(bed);
    setAssignForm(initialAssignForm);
    setDischargeForm(initialDischargeForm);
  };

  const handleAssignBed = async (event) => {
    event.preventDefault();

    if (!selectedRoom?.item?.id || !selectedBed?.id) {
      return;
    }

    try {
      const response = await assignRoomBed(selectedRoom.item.id, selectedBed.id, assignForm);
      setMessage(response.message);
      setSelectedRoom({ item: response.item, beds: response.beds });
      setSelectedBed(null);
      await loadData(filters, selectedRoom.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to assign bed.");
    }
  };

  const handleDischargeBed = async (event) => {
    event.preventDefault();

    if (!selectedRoom?.item?.id || !selectedBed?.id) {
      return;
    }

    try {
      const response = await dischargeRoomBed(selectedRoom.item.id, selectedBed.id, dischargeForm);
      setMessage(response.message);
      setSelectedRoom({ item: response.item, beds: response.beds });
      setSelectedBed(null);
      await loadData(filters, selectedRoom.item.id);
    } catch (apiError) {
      setError(apiError.message || "Unable to discharge bed.");
    }
  };

  const patientLabel = (patient) => `${patient.uhid || patient.registrationNumber || "UHID"} - ${patient.firstName || ""} ${patient.lastName || ""}`.trim();

  return (
    <DashboardLayout>
      <section className="hero-panel logo-hero">
        <div className="eyebrow">Rooms and Beds</div>
        <h2>Track room inventory, bed occupancy, and patient assignment from one operational desk.</h2>
        <p>
          This phase adds room masters, live bed availability, and assign-discharge actions so reception,
          nursing, and administrators can manage inpatient capacity alongside the live IPD admission workflow.
        </p>
      </section>

      <section className="stat-grid">
        <article className="stat-card"><div className="stat-label">Rooms</div><div className="stat-value">{stats.totalRooms}</div><div className="stat-note">Configured room inventory</div></article>
        <article className="stat-card"><div className="stat-label">Beds</div><div className="stat-value">{stats.totalBeds}</div><div className="stat-note">Total tracked beds</div></article>
        <article className="stat-card"><div className="stat-label">Available</div><div className="stat-value">{stats.availableBeds}</div><div className="stat-note">Ready for admission</div></article>
        <article className="stat-card"><div className="stat-label">Occupied</div><div className="stat-value">{stats.occupiedBeds}</div><div className="stat-note">Current live occupancy</div></article>
      </section>

      <section className="workspace-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Create Room</div><h3>Room and bed master setup</h3></div></div>
          <form className="form-grid" onSubmit={handleCreateRoom}>
            <div className="field"><label>Room number</label><input name="roomNumber" value={roomForm.roomNumber} onChange={handleRoomFormChange} /></div>
            <div className="field"><label>Ward</label><input name="ward" value={roomForm.ward} onChange={handleRoomFormChange} /></div>
            <div className="field"><label>Room type</label><select name="roomType" value={roomForm.roomType} onChange={handleRoomFormChange}>{masters.roomTypes.map((type) => (<option key={type} value={type}>{type}</option>))}</select></div>
            <div className="field"><label>Floor</label><input name="floor" value={roomForm.floor} onChange={handleRoomFormChange} /></div>
            <div className="field"><label>Bed count</label><input name="bedCount" type="number" min="1" value={roomForm.bedCount} onChange={handleRoomFormChange} /></div>
            <div className="field"><label>Bed prefix</label><input name="bedPrefix" value={roomForm.bedPrefix} onChange={handleRoomFormChange} /></div>
            <div className="field"><label>Daily charge</label><input name="chargePerDay" value={roomForm.chargePerDay} onChange={handleRoomFormChange} /></div>
            <div className="field"><label>Nursing station</label><input name="nursingStation" value={roomForm.nursingStation} onChange={handleRoomFormChange} /></div>
            <div className="field field-span-2"><label>Notes</label><input name="notes" value={roomForm.notes} onChange={handleRoomFormChange} /></div>
            <div className="field field-span-2"><Button type="submit">Create Room</Button></div>
          </form>
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Room Register</div><h3>Availability by room</h3></div></div>
          <div className="toolbar">
            <select name="roomType" value={filters.roomType} onChange={handleFilterChange}><option value="">All room types</option>{masters.roomTypes.map((type) => (<option key={type} value={type}>{type}</option>))}</select>
            <select name="status" value={filters.status} onChange={handleFilterChange}><option value="">All room statuses</option>{masters.roomStatuses.map((status) => (<option key={status} value={status}>{status}</option>))}</select>
          </div>
          <div className="queue-list">
            {rooms.map((room) => (
              <div key={room.id} className={`queue-item selectable-card${selectedRoom?.item?.id === room.id ? " selected-card" : ""}`} onClick={() => openRoom(room.id)} role="button" tabIndex={0}>
                <div><strong>{room.roomNumber}</strong><div className="timeline-copy">{room.ward}</div><div className="timeline-copy">{room.floor} | {room.roomType}</div></div>
                <div className="queue-actions"><span className={`status-pill ${room.status === "full" ? "in_progress" : room.status === "blocked" ? "cancelled" : "confirmed"}`}>{room.status}</span><div className="timeline-copy">{room.availableBeds}/{room.totalBeds} free</div></div>
              </div>
            ))}
            {!rooms.length ? <div className="empty-state">No rooms found for the selected filters.</div> : null}
          </div>
        </article>
      </section>

      <section className="opd-grid">
        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Room Detail</div><h3>{selectedRoom?.item?.roomNumber || "Select a room"}</h3></div></div>
          {error ? <div className="error-text">{error}</div> : null}
          {message ? <div className="success-text">{message}</div> : null}
          {selectedRoom?.item ? (
            <>
              <div className="detail-grid">
                <article className="content-card inset-card"><h3>Room Snapshot</h3><div className="detail-list"><div><strong>Ward:</strong> {selectedRoom.item.ward}</div><div><strong>Floor:</strong> {selectedRoom.item.floor}</div><div><strong>Type:</strong> {selectedRoom.item.roomType}</div><div><strong>Daily charge:</strong> Rs. {selectedRoom.item.chargePerDay}</div></div></article>
                <article className="content-card inset-card"><h3>Capacity</h3><div className="detail-list"><div><strong>Total beds:</strong> {selectedRoom.item.totalBeds}</div><div><strong>Available:</strong> {selectedRoom.item.availableBeds}</div><div><strong>Occupied:</strong> {selectedRoom.item.occupiedBeds}</div><div><strong>Occupancy:</strong> {selectedRoom.item.occupancyPercent}%</div></div></article>
              </div>
              <div className="stack-list">
                {selectedRoom.beds.map((bed) => (
                  <div key={bed.id} className="quick-action room-bed-card">
                    <div className="room-bed-head">
                      <div><strong>{bed.bedNumber}</strong><div className="timeline-copy">{bed.bedLabel}</div><div className="timeline-copy">{bed.patientName || "No current patient"}</div></div>
                      <div className="queue-actions"><span className={`status-pill ${bed.status === "occupied" ? "in_progress" : bed.status === "available" ? "confirmed" : "cancelled"}`}>{bed.status}</span><Button variant="secondary" onClick={() => selectBed(bed)}>{bed.status === "occupied" ? "Discharge" : "Assign"}</Button></div>
                    </div>
                    <div className="timeline-copy">Expected discharge: {bed.expectedDischargeDate || "Not set"}</div>
                    <div className="timeline-copy">Notes: {bed.note || "No notes"}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="empty-state">Choose a room from the register to manage its beds.</div>}
        </article>

        <article className="content-card">
          <div className="section-header"><div><div className="eyebrow">Bed Action</div><h3>{selectedBed ? `${selectedBed.bedNumber} action panel` : "Select a bed"}</h3></div></div>
          {!selectedBed ? <div className="empty-state">Pick a bed from the room detail panel to assign or discharge it.</div> : selectedBed.status === "occupied" ? (
            <form className="form-grid" onSubmit={handleDischargeBed}>
              <div className="field"><label>Current patient</label><input value={selectedBed.patientName} readOnly disabled /></div>
              <div className="field"><label>Next status</label><select name="nextStatus" value={dischargeForm.nextStatus} onChange={handleDischargeFormChange}><option value="cleaning">cleaning</option><option value="available">available</option><option value="maintenance">maintenance</option></select></div>
              <div className="field field-span-2"><label>Discharge note</label><input name="note" value={dischargeForm.note} onChange={handleDischargeFormChange} /></div>
              <div className="field field-span-2"><Button type="submit">Discharge Bed</Button></div>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleAssignBed}>
              <div className="field field-span-2">
                <label>Patient</label>
                <SearchableSelect
                  value={assignForm.patientId}
                  options={patients}
                  onChange={handleAssignPatientChange}
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
              <div className="field"><label>Admission type</label><select name="admissionType" value={assignForm.admissionType} onChange={handleAssignFormChange}><option value="observation">observation</option><option value="ipd">ipd</option><option value="therapy_recovery">therapy recovery</option></select></div>
              <div className="field"><label>Expected discharge</label><input name="expectedDischargeDate" type="date" value={assignForm.expectedDischargeDate} onChange={handleAssignFormChange} /></div>
              <div className="field field-span-2"><label>Assignment note</label><input name="note" value={assignForm.note} onChange={handleAssignFormChange} /></div>
              <div className="field field-span-2"><Button type="submit">Assign Bed</Button></div>
            </form>
          )}
        </article>
      </section>
    </DashboardLayout>
  );
}
