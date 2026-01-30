// Backend API base URL
const API_BASE = "/api";

// ======== Data Store =========
let payments = [];
let workers = [];
let currentWorker = null; // For worker authentication

// ======== Utility Functions =========
function showTab(tab) {
  document.querySelectorAll(".tab-content").forEach(div => div.classList.add("d-none"));
  document.getElementById("tab-" + tab).classList.remove("d-none");
}

// ======== ADMIN FUNCTIONS =========
async function createPayment(e) {
  e.preventDefault();

  const workorder = document.getElementById('admin_workorder').value.trim();
  const contractor = document.getElementById('admin_contractor').value.trim();
  const amount = Number(document.getElementById('admin_amount').value);

  try {
    const res = await fetch(`${API_BASE}/admin/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workorder, contractor, amount })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const json = await res.json();
    alert('✅ ' + json.message);

    await loadPayments();
    document.getElementById('formCreatePayment').reset();
  } catch (err) {
    alert('❌ Failed: ' + err.message);
  }
}

async function loadPayments() {
  try {
    const res = await fetch(`${API_BASE}/admin/payments`);
    payments = await res.json();
    renderAdminPayments();
  } catch (err) {
    console.error("❌ Failed to load payments:", err);
  }
}

function renderAdminPayments() {
  let container = document.getElementById("adminPaymentsList");
  if (payments.length === 0) {
    container.innerHTML = `<p class="text-muted">No payments yet.</p>`;
    return;
  }

  container.innerHTML = payments.map(p => `
    <div class="border rounded p-3 mb-3">
      <div class="row">
        <div class="col-md-8">
          <strong>WorkOrder:</strong> ${p.workorder} <br>
          <strong>Contractor:</strong> ${p.contractor} <br>
          <strong>Total Amount:</strong> ₹${p.amount} <br>
          <span class="badge ${!p.allocated ? "bg-warning" : p.work_status === 'assigned' ? "bg-info" : "bg-success"}">
            ${!p.allocated ? "Not Assigned" : p.work_status === 'assigned' ? `Work Assigned (${p.workers.length} workers)` : `Work Completed (${p.workers.length} workers)`}
          </span>
        </div>
        <div class="col-md-4">
          ${!p.allocated ? `
            <span class="text-muted">Awaiting work assignment</span>
          ` : p.work_status === 'assigned' ? `
            <span class="badge bg-info mb-2">Work In Progress</span><br>
            <button class="btn btn-info btn-sm w-100" onclick="showWorkerPaymentDetails(${p.id})">
              <i class="bi bi-eye"></i> View Worker Details
            </button>
          ` : `
            <button class="btn btn-info btn-sm w-100" onclick="showWorkerPaymentDetails(${p.id})">
              <i class="bi bi-eye"></i> View Worker Status
            </button>
          `}
        </div>
      </div>
      ${p.allocated && p.workers.length > 0 ? `
        <div class="mt-3">
          <small class="text-muted">Allocated Workers:</small>
          <div class="row mt-2">
            ${p.workers.map(w => `
              <div class="col-md-6 mb-2">
                <div class="small border rounded p-2">
                  <strong>${w.name}</strong> (${w.phone})<br>
                  <span class="text-primary">Promised: ₹${w.promised_amount || 'Not set'}</span><br>
                  <span class="${w.actual_received_by_worker ? 'text-success' : 'text-muted'}">
                    Worker Received: ₹${w.actual_received_by_worker || 'Not confirmed by worker'}
                  </span>
                  ${w.payment_status ? `<br><span class="badge ${w.payment_status === 'verified' ? 'bg-success' : w.payment_status === 'disputed' ? 'bg-danger' : 'bg-warning'}">${w.payment_status === 'verified' ? 'Verified' : w.payment_status === 'disputed' ? 'Disputed' : 'Pending'}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `).join("");
}

async function showRecordPaymentModal(paymentId) {
  const payment = payments.find(p => p.id === paymentId);
  if (!payment || !payment.allocated) {
    alert("Payment not found or not allocated yet!");
    return;
  }

  const container = document.getElementById("adminPaymentsList");
  const paymentModalHtml = `
    <div id="payment-recording-modal" class="glass-card p-3 mb-3 border-primary">
      <h6><i class="bi bi-cash-coin"></i> Record Actual Payments - ${payment.workorder}</h6>
      <div class="alert alert-info">
        <strong>Total Amount:</strong> ₹${payment.amount}<br>
        <strong>Contractor:</strong> ${payment.contractor}
      </div>
      <form id="formRecordPayments" onsubmit="recordActualPayments(event, ${paymentId})">
        <div class="mb-3">
          <label class="form-label">Enter actual amounts paid to each worker:</label>
          ${payment.workers.map((w, index) => `
            <div class="row mb-2 align-items-center">
              <div class="col-md-4">
                <strong>${w.name}</strong><br>
                <small class="text-muted">${w.phone}</small>
              </div>
              <div class="col-md-3">
                <input type="number" step="0.01" min="0" 
                       class="form-control form-control-sm" 
                       id="promised_${index}" 
                       placeholder="Promised amount"
                       value="${w.promised_amount || ''}" />
                <small class="text-muted">Promised</small>
              </div>
              <div class="col-md-3">
                <input type="number" step="0.01" min="0" 
                       class="form-control form-control-sm" 
                       id="actual_${index}" 
                       placeholder="Actually paid"
                       value="${w.actual_paid || ''}" />
                <small class="text-muted">Actually Paid</small>
              </div>
              <div class="col-md-2">
                <span class="badge ${w.payment_status === 'verified' ? 'bg-success' : w.payment_status === 'disputed' ? 'bg-danger' : 'bg-warning'}">
                  ${w.payment_status === 'verified' ? 'Verified' : w.payment_status === 'disputed' ? 'Disputed' : 'Pending'}
                </span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-success" type="submit">
            <i class="bi bi-check-circle"></i> Save Payment Records
          </button>
          <button class="btn btn-secondary" type="button" onclick="closePaymentModal()">
            <i class="bi bi-x-circle"></i> Cancel
          </button>
        </div>
      </form>
    </div>
  `;
  
  container.insertAdjacentHTML('afterbegin', paymentModalHtml);
}

async function recordActualPayments(event, paymentId) {
  event.preventDefault();
  
  const payment = payments.find(p => p.id === paymentId);
  if (!payment) {
    alert("Payment not found!");
    return;
  }

  const workerPayments = payment.workers.map((worker, index) => {
    const promisedAmount = parseFloat(document.getElementById(`promised_${index}`).value) || 0;
    const actualAmount = parseFloat(document.getElementById(`actual_${index}`).value) || 0;
    
    return {
      worker_phone: worker.phone,
      worker_name: worker.name,
      promised_amount: promisedAmount,
      actual_paid: actualAmount
    };
  });

  try {
    const res = await fetch(`${API_BASE}/admin/payments/${paymentId}/record-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_payments: workerPayments })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const json = await res.json();
    alert('✅ ' + json.message);

    await loadPayments();
    closePaymentModal();
    await loadAllWorkerPayments();

  } catch (err) {
    alert('❌ Failed to record payments: ' + err.message);
  }
}

function closePaymentModal() {
  const modal = document.getElementById("payment-recording-modal");
  if (modal) {
    modal.remove();
  }
}

async function loadAllWorkerPayments() {
  try {
    const res = await fetch(`${API_BASE}/admin/worker-payments`);
    const workerPayments = await res.json();
    renderAllWorkerPayments(workerPayments);
  } catch (err) {
    console.error("❌ Failed to load worker payments:", err);
  }
}

function renderAllWorkerPayments(workerPayments) {
  const container = document.getElementById("allWorkerPaymentsList");
  
  if (workerPayments.length === 0) {
    container.innerHTML = `<p class="text-muted">No worker payment records yet.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>Worker</th>
            <th>Phone</th>
            <th>WorkOrder</th>
            <th>Contractor</th>
            <th>Promised</th>
            <th>Paid</th>
            <th>Status</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          ${workerPayments.map(wp => `
            <tr>
              <td><strong>${wp.worker_name}</strong></td>
              <td>${wp.worker_phone}</td>
              <td>${wp.workorder}</td>
              <td>${wp.contractor}</td>
              <td class="text-primary">₹${wp.promised_amount || 'Not set'}</td>
              <td class="text-success">₹${wp.actual_paid || 'Not recorded'}</td>
              <td>
                <span class="badge ${wp.payment_status === 'verified' ? 'bg-success' : wp.payment_status === 'disputed' ? 'bg-danger' : 'bg-warning'}">
                  ${wp.payment_status || 'pending'}
                </span>
              </td>
              <td><small class="text-muted">${new Date(wp.updated_at).toLocaleString()}</small></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ======== CONTRACTOR FUNCTIONS =========
function loadContractorPayments() {
  let contractorName = document.getElementById("contractor_name_input").value.trim();
  let container = document.getElementById("contractorPaymentsList");

  if (!contractorName) {
    alert("Enter contractor name first!");
    return;
  }

  let contractorPayments = payments.filter(
    p => p.contractor.toLowerCase() === contractorName.toLowerCase()
  );

  if (contractorPayments.length === 0) {
    container.innerHTML = `<p class="text-muted">No payments found for this contractor.</p>`;
    return;
  }

  container.innerHTML = contractorPayments.map(p => `
    <div class="border rounded p-3 mb-3">
      <div class="row">
        <div class="col-md-8">
          <strong>WorkOrder:</strong> ${p.workorder} <br>
          <strong>Total Amount:</strong> ₹${p.amount} <br>
          <span class="badge ${!p.allocated ? "bg-warning" : p.work_status === 'assigned' ? "bg-info" : "bg-success"}">
            ${!p.allocated ? "Not Assigned" : p.work_status === 'assigned' ? `Work Assigned (${p.workers.length} workers)` : `Work Completed (${p.workers.length} workers)`}
          </span>
        </div>
        <div class="col-md-4">
          ${!p.allocated ? `
            <button class="btn btn-primary btn-sm w-100" onclick="showAllocationModal(${p.id})">
              <i class="bi bi-people-fill"></i> Assign Work to Workers
            </button>
          ` : p.work_status === 'assigned' ? `
            <button class="btn btn-warning btn-sm w-100 mb-2" onclick="markWorkComplete(${p.id})">
              <i class="bi bi-check-circle"></i> Mark Work Complete
            </button>
            <button class="btn btn-info btn-sm w-100" onclick="showWorkersList(${p.id})">
              <i class="bi bi-eye"></i> View Workers (${p.workers.length})
            </button>
          ` : `
            <span class="badge bg-success mb-2">Work Completed</span><br>
            <button class="btn btn-info btn-sm w-100" onclick="showWorkersList(${p.id})">
              <i class="bi bi-eye"></i> View Workers (${p.workers.length})
            </button>
          `}
        </div>
      </div>
      ${p.allocated ? `
        <div class="mt-2">
          <small class="text-muted">Workers & Amounts:</small>
          <div class="small">
            ${p.workers.map(w => `<span class="badge bg-secondary me-1">${w.name} (${w.phone}) - ₹${w.promised_amount || 'Not set'}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `).join("");
}

// ======== WORKER FUNCTIONS =========
function addWorker(event) {
  event.preventDefault();

  let name = document.getElementById("w_name").value.trim();
  let phone = document.getElementById("w_phone").value.trim();
  let aadhaar = document.getElementById("w_aadhaar").value.trim();

  if (!name || !phone) {
    alert("Please enter worker name and phone.");
    return;
  }

  let worker = { id: Date.now(), name, phone, aadhaar };
  workers.push(worker);

  document.getElementById("formAddWorker").reset();
  renderWorkers();
  alert("Worker added ✅");
}

function renderWorkers() {
  let container = document.getElementById("workersList");

  if (workers.length === 0) {
    container.innerHTML = `<p class="text-muted">No workers added yet.</p>`;
    return;
  }

  container.innerHTML = `
    <ul class="list-group">
      ${workers.map(w => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          ${w.name} (${w.phone})
          ${w.aadhaar ? `<span class="badge bg-secondary">Aadhaar: ${w.aadhaar}</span>` : ""}
        </li>
      `).join("")}
    </ul>
  `;
}

// ======== WORKER AUTHENTICATION =========
async function workerLogin() {
  const phone = document.getElementById("worker_login_phone").value.trim();
  const name = document.getElementById("worker_login_name").value.trim();

  if (!phone || !name) {
    alert("Please enter both phone number and name!");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/worker/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Login failed`);
    }

    const json = await res.json();
    currentWorker = json.worker;
    
    // Hide login section, show dashboard
    document.getElementById("workerLoginSection").classList.add("d-none");
    document.getElementById("workerDashboard").classList.remove("d-none");
    
    // Update worker info
    document.getElementById("workerName").textContent = currentWorker.name;
    document.getElementById("workerPhone").textContent = currentWorker.phone;
    
    // Load worker payments
    await loadWorkerPayments();
    
  } catch (err) {
    alert('❌ Login failed: ' + err.message);
  }
}

function workerLogout() {
  currentWorker = null;
  document.getElementById("workerLoginSection").classList.remove("d-none");
  document.getElementById("workerDashboard").classList.add("d-none");
  document.getElementById("worker_login_phone").value = "";
  document.getElementById("worker_login_name").value = "";
}

async function loadWorkerPayments() {
  if (!currentWorker) return;

  try {
    const res = await fetch(`${API_BASE}/worker/${currentWorker.phone}/payments`);
    const workerPayments = await res.json();
    renderWorkerPayments(workerPayments);
    updateDiscrepancyOptions(workerPayments);
  } catch (err) {
    console.error("❌ Failed to load worker payments:", err);
  }
}

function renderWorkerPayments(workerPayments) {
  const container = document.getElementById("workerPaymentsList");
  
  if (workerPayments.length === 0) {
    container.innerHTML = `<p class="text-muted">No payment allocations found for you.</p>`;
    return;
  }

  container.innerHTML = workerPayments.map(wp => {
    const promisedAmount = wp.promised_amount || 0;
    const actualReceived = wp.actual_received_by_worker || 0;
    const difference = actualReceived - promisedAmount;
    
    return `
      <div class="border rounded p-3 mb-3 ${wp.payment_status === 'disputed' ? 'border-danger' : wp.payment_status === 'verified' ? 'border-success' : ''}">
        <div class="row">
          <div class="col-md-8">
            <h6>${wp.workorder}</h6>
            <strong>Contractor:</strong> ${wp.contractor}<br>
            <strong>Promised Amount:</strong> <span class="text-primary">₹${promisedAmount}</span><br>
            ${wp.payment_status === 'verified' ? `
              <strong>Amount You Received:</strong> <span class="text-success">₹${actualReceived}</span><br>
              ${actualReceived > 0 && promisedAmount > 0 ? `
                <strong>Difference:</strong> <span class="${difference >= 0 ? 'text-success' : 'text-danger'}">₹${difference}</span>
              ` : ''}
            ` : promisedAmount > 0 && wp.payment_status !== 'disputed' ? `
              <div class="mt-2">
                <label class="form-label small"><strong>Enter actual amount you received:</strong></label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text">₹</span>
                  <input type="number" min="0" step="0.01" class="form-control" 
                         id="actual_received_${wp.worker_phone}_${wp.workorder}" 
                         placeholder="Amount received"
                         value="${actualReceived || ''}" />
                  <button class="btn btn-success" onclick="verifyPaymentWithAmount('${wp.worker_phone}', '${wp.workorder}')">
                    <i class="bi bi-check-circle"></i> Verify
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="col-md-4 text-end">
            <span class="badge ${wp.payment_status === 'verified' ? 'bg-success' : wp.payment_status === 'disputed' ? 'bg-danger' : 'bg-warning'} mb-2">
              ${wp.payment_status === 'verified' ? 'Verified' : wp.payment_status === 'disputed' ? 'Disputed' : 'Pending'}
            </span>
          </div>
        </div>
        <small class="text-muted">Last updated: ${new Date(wp.updated_at).toLocaleString()}</small>
      </div>
    `;
  }).join("");
}

function updateDiscrepancyOptions(workerPayments) {
  const select = document.getElementById("discrepancy_payment_id");
  select.innerHTML = '<option value="">Select a payment allocation</option>';
  
  workerPayments.forEach(wp => {
    select.innerHTML += `
      <option value="${wp.worker_phone}|${wp.workorder}">
        ${wp.workorder} - ${wp.contractor} (Promised: ₹${wp.promised_amount || 'Not set'})
      </option>
    `;
  });
}

async function verifyPaymentWithAmount(workerPhone, workorder) {
  const inputId = `actual_received_${workerPhone}_${workorder}`;
  const actualReceivedInput = document.getElementById(inputId);
  
  if (!actualReceivedInput) {
    alert('❌ Amount input not found');
    return;
  }
  
  const actualReceived = parseFloat(actualReceivedInput.value);
  
  if (!actualReceived || actualReceived <= 0) {
    alert('❌ Please enter the actual amount you received');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/worker/verify-payment-with-amount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        worker_phone: workerPhone, 
        workorder: workorder,
        actual_received: actualReceived,
        verified: true 
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Verification failed`);
    }

    const json = await res.json();
    alert('✅ ' + json.message);
    await loadWorkerPayments();
    
  } catch (err) {
    alert('❌ Verification failed: ' + err.message);
  }
}

async function reportDiscrepancy(event) {
  event.preventDefault();
  
  const paymentSelection = document.getElementById("discrepancy_payment_id").value;
  const actualReceived = parseFloat(document.getElementById("actual_received_amount").value);
  const notes = document.getElementById("discrepancy_notes").value.trim();
  
  if (!paymentSelection) {
    alert("Please select a payment allocation!");
    return;
  }
  
  const [workerPhone, workorder] = paymentSelection.split('|');
  
  try {
    const res = await fetch(`${API_BASE}/worker/report-discrepancy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        worker_phone: workerPhone,
        workorder: workorder,
        actual_received: actualReceived,
        notes: notes
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Report failed`);
    }

    const json = await res.json();
    alert('✅ ' + json.message);
    
    document.getElementById("formReportDiscrepancy").reset();
    await loadWorkerPayments();
    
  } catch (err) {
    alert('❌ Failed to report discrepancy: ' + err.message);
  }
}

// ======== ALLOCATION FUNCTIONS =========
function showAllocationModal(paymentId) {
  if (workers.length === 0) {
    alert("No workers added yet! Please add workers first in the 'Add Worker' section below.");
    return;
  }

  const payment = payments.find(p => p.id === paymentId);
  if (!payment) {
    alert("Payment not found!");
    return;
  }

  const workerSelectionRows = workers.map(w => `
    <div class="row mb-2 align-items-center">
      <div class="col-md-1">
        <input class="form-check-input" type="checkbox" value="${w.id}" id="worker_${w.id}">
      </div>
      <div class="col-md-5">
        <label class="form-check-label" for="worker_${w.id}">
          <strong>${w.name}</strong> (${w.phone})${w.aadhaar ? `<br><small>Aadhaar: ${w.aadhaar}</small>` : ''}
        </label>
      </div>
      <div class="col-md-4">
        <input type="number" step="0.01" min="0" class="form-control form-control-sm" 
               id="amount_${w.id}" placeholder="Amount for this worker" disabled>
      </div>
      <div class="col-md-2">
        <small class="text-muted">₹</small>
      </div>
    </div>
  `).join('');

  const container = document.getElementById("contractorPaymentsList");
  const allocationHtml = `
    <div id="allocation-section" class="glass-card p-3 mb-3 border-primary">
      <h6><i class="bi bi-people-fill"></i> Allocate Work & Set Payment Amounts</h6>
      <div class="alert alert-info">
        <strong>Project:</strong> ${payment.workorder} - Total: ₹${payment.amount}<br>
        <strong>Contractor:</strong> ${payment.contractor}
      </div>
      <div class="mb-3">
        <label class="form-label">Select Workers and Set Individual Payment Amounts:</label>
        <div class="border rounded p-2">
          ${workerSelectionRows}
        </div>
        <small class="text-muted">Note: Work will be assigned to selected workers. Payment will be made only after work completion.</small>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-success" onclick="allocatePaymentToWorkers(${paymentId})">
          <i class="bi bi-check-circle"></i> Assign Work to Workers
        </button>
        <button class="btn btn-secondary" onclick="cancelAllocation()">
          <i class="bi bi-x-circle"></i> Cancel
        </button>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('afterbegin', allocationHtml);
  
  // Add event listeners to enable/disable amount inputs based on checkbox selection
  workers.forEach(w => {
    const checkbox = document.getElementById(`worker_${w.id}`);
    const amountInput = document.getElementById(`amount_${w.id}`);
    
    checkbox.addEventListener('change', function() {
      amountInput.disabled = !this.checked;
      if (!this.checked) {
        amountInput.value = '';
      }
    });
  });
}

async function allocatePaymentToWorkers(paymentId) {
  const selectedWorkerIds = Array.from(document.querySelectorAll('#allocation-section input[type="checkbox"]:checked'))
    .map(cb => parseInt(cb.value));

  if (selectedWorkerIds.length === 0) {
    alert("Please select at least one worker!");
    return;
  }

  const selectedWorkers = workers.filter(w => selectedWorkerIds.includes(w.id))
    .map(w => {
      const amountInput = document.getElementById(`amount_${w.id}`);
      const promisedAmount = parseFloat(amountInput.value) || 0;
      
      return {
        name: w.name,
        phone: w.phone,
        aadhaar: w.aadhaar || '',
        promised_amount: promisedAmount
      };
    });

  // Validate that all selected workers have amounts set
  const workersWithoutAmount = selectedWorkers.filter(w => w.promised_amount <= 0);
  if (workersWithoutAmount.length > 0) {
    alert("Please set payment amounts for all selected workers!");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/payments/${paymentId}/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers: selectedWorkers })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const json = await res.json();
    alert('✅ Work assigned successfully! ' + json.message);

    await loadPayments();
    cancelAllocation();
    loadContractorPayments();

  } catch (err) {
    alert('❌ Failed to assign work: ' + err.message);
  }
}

function cancelAllocation() {
  const allocationSection = document.getElementById("allocation-section");
  if (allocationSection) {
    allocationSection.remove();
  }
}

function showWorkersList(paymentId) {
  const payment = payments.find(p => p.id === paymentId);
  if (!payment) {
    alert("Payment not found!");
    return;
  }

  if (payment.workers.length === 0) {
    alert("No workers allocated to this payment.");
    return;
  }

  const workersList = payment.workers.map(w => 
    `• ${w.name} (${w.phone})${w.aadhaar ? ` - Aadhaar: ${w.aadhaar}` : ''}`
  ).join('\n');

  alert(`Workers allocated to ${payment.workorder}:\n\n${workersList}`);
}

function showWorkerPaymentDetails(paymentId) {
  const payment = payments.find(p => p.id === paymentId);
  if (!payment) {
    alert("Payment not found!");
    return;
  }

  const workerDetails = payment.workers.map(w => 
    `• ${w.name} (${w.phone}) - Promised: ₹${w.promised_amount || 'Not set'}, Paid: ₹${w.actual_paid || 'Not recorded'}`
  ).join('\n');

  alert(`Worker Payment Details for ${payment.workorder}:\n\n${workerDetails}`);
}

async function markWorkComplete(paymentId) {
  if (!confirm("Mark this work as completed? This will allow payment processing for workers.")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/payments/${paymentId}/mark-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const json = await res.json();
    alert('✅ ' + json.message);

    await loadPayments();
    loadContractorPayments();

  } catch (err) {
    alert('❌ Failed to mark work complete: ' + err.message);
  }
}

// ======== INITIALIZATION =========
async function initializeApp() {
  await loadPayments();
  renderWorkers();
  await loadAllWorkerPayments();
}

// Initialize the app when page loads
initializeApp();
