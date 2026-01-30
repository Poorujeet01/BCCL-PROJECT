import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default_secret_key_for_development")

# Enable CORS for all routes
CORS(app)

# In-memory data storage for MVP
payments_data = []
payment_id_counter = 1

# Worker payment records storage
worker_payments = []

# Utility function to generate unique payment IDs
def generate_payment_id():
    global payment_id_counter
    current_id = payment_id_counter
    payment_id_counter += 1
    return current_id

# Helper function to find worker payment record
def find_worker_payment(worker_phone, workorder):
    for wp in worker_payments:
        if wp['worker_phone'] == worker_phone and wp['workorder'] == workorder:
            return wp
    return None

# Helper function to update or create worker payment record
def update_worker_payment(worker_phone, worker_name, workorder, contractor, **kwargs):
    wp = find_worker_payment(worker_phone, workorder)
    if wp:
        # Update existing record
        for key, value in kwargs.items():
            wp[key] = value
        wp['updated_at'] = datetime.now().isoformat()
    else:
        # Create new record
        new_wp = {
            'worker_phone': worker_phone,
            'worker_name': worker_name,
            'workorder': workorder,
            'contractor': contractor,
            'promised_amount': kwargs.get('promised_amount', 0),
            'actual_paid': kwargs.get('actual_paid', 0),
            'payment_status': kwargs.get('payment_status', 'pending'),
            'work_status': kwargs.get('work_status', 'assigned'),  # assigned -> in_progress -> completed
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        worker_payments.append(new_wp)

# Static file routes
@app.route('/')
def serve_index():
    """Serve the main index.html file"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS, images)"""
    return send_from_directory('.', filename)

@app.route('/api/admin/payments', methods=['POST'])
def create_payment():
    """Create a new payment entry"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        workorder = data.get('workorder', '').strip()
        contractor = data.get('contractor', '').strip()
        amount = data.get('amount')
        
        # Validation
        if not workorder:
            return jsonify({"error": "WorkOrder is required"}), 400
        if not contractor:
            return jsonify({"error": "Contractor name is required"}), 400
        if not amount or not isinstance(amount, (int, float)) or amount <= 0:
            return jsonify({"error": "Valid amount is required"}), 400
        
        # Create new payment record
        payment = {
            "id": generate_payment_id(),
            "workorder": workorder,
            "contractor": contractor,
            "amount": float(amount),
            "allocated": False,
            "workers": [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        payments_data.append(payment)
        
        app.logger.info(f"Payment created: ID {payment['id']}, WorkOrder: {workorder}, Contractor: {contractor}, Amount: {amount}")
        
        return jsonify({
            "message": f"Payment created successfully for {contractor}",
            "payment_id": payment["id"],
            "payment": payment
        }), 201
        
    except Exception as e:
        app.logger.error(f"Error creating payment: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/admin/payments', methods=['GET'])
def get_all_payments():
    """Retrieve all payment records"""
    try:
        app.logger.info(f"Retrieving {len(payments_data)} payments")
        return jsonify(payments_data), 200
        
    except Exception as e:
        app.logger.error(f"Error retrieving payments: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/admin/payments/<int:payment_id>/record-payments', methods=['POST'])
def record_actual_payments(payment_id):
    """Record actual payments made to workers"""
    try:
        data = request.get_json()
        
        if not data or 'worker_payments' not in data:
            return jsonify({"error": "Worker payments data is required"}), 400
            
        worker_payment_records = data['worker_payments']
        
        # Find the payment
        payment = None
        for p in payments_data:
            if p['id'] == payment_id:
                payment = p
                break
                
        if not payment:
            return jsonify({"error": "Payment not found"}), 404
            
        if not payment['allocated']:
            return jsonify({"error": "Payment not allocated to workers yet"}), 400
            
        if payment.get('work_status') != 'completed':
            return jsonify({"error": "Work must be completed before recording payments"}), 400
        
        # Update payment workers with actual amounts
        for wp_record in worker_payment_records:
            worker_phone = wp_record.get('worker_phone')
            worker_name = wp_record.get('worker_name')
            promised_amount = wp_record.get('promised_amount', 0)
            actual_paid = wp_record.get('actual_paid', 0)
            
            # Update the worker in the payment record
            for worker in payment['workers']:
                if worker['phone'] == worker_phone:
                    worker['promised_amount'] = promised_amount
                    worker['actual_paid'] = actual_paid
                    worker['payment_status'] = 'pending'
                    break
            
            # Update or create worker payment record
            update_worker_payment(
                worker_phone, worker_name, payment['workorder'], payment['contractor'],
                promised_amount=promised_amount, actual_paid=actual_paid, payment_status='pending'
            )
        
        payment['updated_at'] = datetime.now().isoformat()
        
        app.logger.info(f"Recorded actual payments for payment {payment_id}")
        
        return jsonify({
            "message": f"Payment records updated for {len(worker_payment_records)} workers",
            "payment": payment
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error recording actual payments: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/admin/worker-payments', methods=['GET'])
def get_all_worker_payments():
    """Get all worker payment records for admin view"""
    try:
        app.logger.info(f"Retrieving {len(worker_payments)} worker payment records")
        return jsonify(worker_payments), 200
        
    except Exception as e:
        app.logger.error(f"Error retrieving worker payments: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/payments/contractor/<contractor_name>', methods=['GET'])
def get_contractor_payments(contractor_name):
    """Get payments for a specific contractor"""
    try:
        contractor_name = contractor_name.strip().lower()
        contractor_payments = [
            payment for payment in payments_data 
            if payment['contractor'].lower() == contractor_name
        ]
        
        app.logger.info(f"Found {len(contractor_payments)} payments for contractor: {contractor_name}")
        return jsonify(contractor_payments), 200
        
    except Exception as e:
        app.logger.error(f"Error retrieving contractor payments: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/payments/<int:payment_id>/allocate', methods=['POST'])
def allocate_payment_to_workers(payment_id):
    """Allocate a payment to workers with specific amounts"""
    try:
        data = request.get_json()
        
        if not data or 'workers' not in data:
            return jsonify({"error": "Workers list is required"}), 400
            
        workers = data['workers']
        if not isinstance(workers, list) or len(workers) == 0:
            return jsonify({"error": "At least one worker is required"}), 400
        
        # Find the payment
        payment = None
        for p in payments_data:
            if p['id'] == payment_id:
                payment = p
                break
                
        if not payment:
            return jsonify({"error": "Payment not found"}), 404
            
        # Validate worker data and amounts
        for worker in workers:
            if not isinstance(worker, dict):
                return jsonify({"error": "Invalid worker data format"}), 400
            if not worker.get('name', '').strip():
                return jsonify({"error": "Worker name is required"}), 400
            if not worker.get('phone', '').strip():
                return jsonify({"error": "Worker phone is required"}), 400
            # Add promised_amount to worker data if provided
            if 'promised_amount' in worker:
                worker['promised_amount'] = float(worker.get('promised_amount', 0))
        
        # Update payment with worker allocations and work status
        payment['workers'] = workers
        payment['allocated'] = True
        payment['work_status'] = 'assigned'  # assigned -> in_progress -> completed
        payment['updated_at'] = datetime.now().isoformat()
        
        # Create initial worker payment records
        for worker in workers:
            update_worker_payment(
                worker['phone'], worker['name'], payment['workorder'], 
                payment['contractor'], payment_status='allocated',
                promised_amount=worker.get('promised_amount', 0),
                work_status='assigned'
            )
        
        app.logger.info(f"Payment {payment_id} allocated to {len(workers)} workers")
        
        return jsonify({
            "message": f"Payment allocated to {len(workers)} workers successfully",
            "payment": payment
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error allocating payment: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/payments/<int:payment_id>/mark-complete', methods=['POST'])
def mark_work_complete(payment_id):
    """Mark work as completed for a payment"""
    try:
        # Find the payment
        payment = None
        for p in payments_data:
            if p['id'] == payment_id:
                payment = p
                break
                
        if not payment:
            return jsonify({"error": "Payment not found"}), 404
            
        if not payment['allocated']:
            return jsonify({"error": "Payment not allocated to workers yet"}), 400
        
        # Update work status to completed
        payment['work_status'] = 'completed'
        payment['completed_at'] = datetime.now().isoformat()
        payment['updated_at'] = datetime.now().isoformat()
        
        # Update worker payment records
        for worker in payment['workers']:
            update_worker_payment(
                worker['phone'], worker['name'], payment['workorder'], 
                payment['contractor'], work_status='completed'
            )
        
        app.logger.info(f"Work marked as completed for payment {payment_id}")
        
        return jsonify({
            "message": "Work marked as completed. You can now make payments to workers.",
            "payment": payment
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error marking work complete: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

# Worker Authentication and Payment APIs

@app.route('/api/worker/login', methods=['POST'])
def worker_login():
    """Simple worker authentication using phone and name"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        phone = data.get('phone', '').strip()
        name = data.get('name', '').strip()
        
        if not phone or not name:
            return jsonify({"error": "Phone and name are required"}), 400
        
        # Check if worker exists in any payment allocation
        worker_found = False
        for payment in payments_data:
            if payment['allocated']:
                for worker in payment['workers']:
                    if worker['phone'] == phone and worker['name'].lower() == name.lower():
                        worker_found = True
                        break
                if worker_found:
                    break
        
        if not worker_found:
            return jsonify({"error": "Worker not found in any payment allocation"}), 404
        
        app.logger.info(f"Worker login successful: {name} ({phone})")
        
        return jsonify({
            "message": "Login successful",
            "worker": {"name": name, "phone": phone}
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error in worker login: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/worker/<phone>/payments', methods=['GET'])
def get_worker_payments(phone):
    """Get payment records for a specific worker"""
    try:
        phone = phone.strip()
        worker_payment_records = [
            wp for wp in worker_payments 
            if wp['worker_phone'] == phone
        ]
        
        app.logger.info(f"Found {len(worker_payment_records)} payment records for worker: {phone}")
        return jsonify(worker_payment_records), 200
        
    except Exception as e:
        app.logger.error(f"Error retrieving worker payments: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/worker/verify-payment', methods=['POST'])
def verify_worker_payment():
    """Worker verifies that payment amount is correct"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        worker_phone = data.get('worker_phone', '').strip()
        workorder = data.get('workorder', '').strip()
        verified = data.get('verified', False)
        
        if not worker_phone or not workorder:
            return jsonify({"error": "Worker phone and workorder are required"}), 400
        
        # Find worker payment record
        wp = find_worker_payment(worker_phone, workorder)
        if not wp:
            return jsonify({"error": "Payment record not found"}), 404
        
        # Update payment status
        if verified:
            wp['payment_status'] = 'verified'
        else:
            wp['payment_status'] = 'pending'
        
        wp['updated_at'] = datetime.now().isoformat()
        
        # Also update in the main payment record
        for payment in payments_data:
            if payment['workorder'] == workorder:
                for worker in payment['workers']:
                    if worker['phone'] == worker_phone:
                        worker['payment_status'] = wp['payment_status']
                        break
                break
        
        app.logger.info(f"Payment verification updated: {worker_phone} - {workorder} - {wp['payment_status']}")
        
        return jsonify({
            "message": f"Payment {'verified' if verified else 'marked as pending'}",
            "payment_record": wp
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error verifying payment: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/worker/verify-payment-with-amount', methods=['POST'])
def verify_worker_payment_with_amount():
    """Worker verifies payment by entering actual received amount"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        worker_phone = data.get('worker_phone', '').strip()
        workorder = data.get('workorder', '').strip()
        actual_received = data.get('actual_received', 0)
        verified = data.get('verified', False)
        
        if not worker_phone or not workorder:
            return jsonify({"error": "Worker phone and workorder are required"}), 400
        
        if actual_received <= 0:
            return jsonify({"error": "Actual received amount must be greater than 0"}), 400
        
        # Find worker payment record
        wp = find_worker_payment(worker_phone, workorder)
        if not wp:
            return jsonify({"error": "Payment record not found"}), 404
        
        # Update payment record with actual received amount and verification
        wp['actual_received_by_worker'] = actual_received
        if verified:
            wp['payment_status'] = 'verified'
        else:
            wp['payment_status'] = 'pending'
        
        wp['updated_at'] = datetime.now().isoformat()
        
        # Also update in the main payment record
        for payment in payments_data:
            if payment['workorder'] == workorder:
                for worker in payment['workers']:
                    if worker['phone'] == worker_phone:
                        worker['payment_status'] = wp['payment_status']
                        worker['actual_received_by_worker'] = actual_received
                        break
                break
        
        app.logger.info(f"Payment verified with amount: {worker_phone} - {workorder} - ₹{actual_received}")
        
        return jsonify({
            "message": f"Payment verified! Amount received: ₹{actual_received}",
            "payment_record": wp
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error verifying payment with amount: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/worker/report-discrepancy', methods=['POST'])
def report_payment_discrepancy():
    """Worker reports payment discrepancy"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        worker_phone = data.get('worker_phone', '').strip()
        workorder = data.get('workorder', '').strip()
        actual_received = data.get('actual_received', 0)
        notes = data.get('notes', '').strip()
        
        if not worker_phone or not workorder:
            return jsonify({"error": "Worker phone and workorder are required"}), 400
        
        # Find worker payment record
        wp = find_worker_payment(worker_phone, workorder)
        if not wp:
            return jsonify({"error": "Payment record not found"}), 404
        
        # Update payment record with discrepancy
        wp['payment_status'] = 'disputed'
        wp['actual_received_by_worker'] = actual_received
        wp['discrepancy_notes'] = notes
        wp['discrepancy_reported_at'] = datetime.now().isoformat()
        wp['updated_at'] = datetime.now().isoformat()
        
        # Also update in the main payment record
        for payment in payments_data:
            if payment['workorder'] == workorder:
                for worker in payment['workers']:
                    if worker['phone'] == worker_phone:
                        worker['payment_status'] = 'disputed'
                        worker['actual_received_by_worker'] = actual_received
                        worker['discrepancy_notes'] = notes
                        break
                break
        
        app.logger.info(f"Payment discrepancy reported: {worker_phone} - {workorder}")
        
        return jsonify({
            "message": "Payment discrepancy reported successfully. Admin will review this issue.",
            "payment_record": wp
        }), 200
        
    except Exception as e:
        app.logger.error(f"Error reporting discrepancy: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "BCCL WPTS Backend",
        "timestamp": datetime.now().isoformat(),
        "payments_count": len(payments_data),
        "worker_payments_count": len(worker_payments)
    }), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"error": "Method not allowed"}), 405

@app.errorhandler(500)
def internal_error(error):
    app.logger.error(f"Internal server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.logger.info("Starting BCCL WPTS Backend API Server...")
    app.logger.info(f"Server will be available at: http://127.0.0.1:5000")
    app.logger.info("API endpoints:")
    app.logger.info("  POST /api/admin/payments - Create payment")
    app.logger.info("  GET  /api/admin/payments - Get all payments")
    app.logger.info("  POST /api/admin/payments/<id>/record-payments - Record actual payments")
    app.logger.info("  GET  /api/admin/worker-payments - Get all worker payments")
    app.logger.info("  GET  /api/payments/contractor/<name> - Get contractor payments")
    app.logger.info("  POST /api/payments/<id>/allocate - Allocate payment to workers")
    app.logger.info("  POST /api/worker/login - Worker authentication")
    app.logger.info("  GET  /api/worker/<phone>/payments - Get worker payments")
    app.logger.info("  POST /api/worker/verify-payment - Verify payment")
    app.logger.info("  POST /api/worker/report-discrepancy - Report payment discrepancy")
    app.logger.info("  GET  /api/health - Health check")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
