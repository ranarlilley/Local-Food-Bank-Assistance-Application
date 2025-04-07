from flask import Flask, request, session, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
import os
from pathlib import Path
from datetime import datetime
from functools import wraps
from sqlalchemy.orm import joinedload
from werkzeug.exceptions import HTTPException
from sqlalchemy import inspect


#we will initialize the Flask app
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-123')
app.config['PERMANENT_SESSION_LIFETIME'] = 3600
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS

#our cors setup
CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:5173", "https://local-food-bank-assistance-app.herokuapp.com"]}},
    supports_credentials=True
)
#our database setup
db_path = os.path.join(os.path.dirname(__file__), "instance", "foodbank.db")
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


#our models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    password = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='recipient')
    is_vip = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Request(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    status = db.Column(db.String(20), default='pending')
    claimed_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    claimed_at = db.Column(db.DateTime, nullable=True)
    user = db.relationship('User', foreign_keys=[user_id])
    donor = db.relationship('User', foreign_keys=[claimed_by])


class FoodItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    category = db.Column(db.String(20))
    quantity = db.Column(db.Integer, default=1)
    request_id = db.Column(db.Integer, db.ForeignKey('request.id'))


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])


#for error issues
@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return e
    return make_response(jsonify({
        "error": str(e),
        "message": "An unexpected error occurred"
    }), 500)


#we will add a decorator for role-based access control
def role_required(role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Not logged in'}), 401
            user = User.query.get(session['user_id'])
            if not user:
                return jsonify({'error': 'User not found'}), 404
            if user.role != role:
                return jsonify({'error': f'{role} access only'}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator



def is_valid_name(name):
    return isinstance(name, str) and 2 <= len(name) <= 50


def is_valid_password(password):
    return (isinstance(password, str) and
            len(password) >= 8 and
            any(c.isupper() for c in password) and
            any(c.isdigit() for c in password))


@app.route('/')
def home():
    return 'Welcome to Food Bank App!'


@app.route('/api/check-session', methods=['GET'])
def check_session():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({
                'user': {
                    'id': user.id,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
                    'is_vip': user.is_vip
                }
            }), 200
    return jsonify({'error': 'Not logged in'}), 401


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    required_fields = ['first_name', 'last_name', 'password', 'confirm_password']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing fields'}), 400

    if not is_valid_name(data['first_name']):
        return jsonify({'error': 'First name must be 2-50 characters'}), 400
    if not is_valid_name(data['last_name']):
        return jsonify({'error': 'Last name must be 2-50 characters'}), 400
    if not is_valid_password(data['password']):
        return jsonify({'error': 'Password must be 8+ chars with uppercase and number'}), 400
    if data['password'] != data['confirm_password']:
        return jsonify({'error': 'Passwords do not match'}), 400

    if User.query.filter_by(first_name=data['first_name'], last_name=data['last_name']).first():
        return jsonify({'error': 'User already exists'}), 400

    new_user = User(
        first_name=data['first_name'],
        last_name=data['last_name'],
        password=generate_password_hash(data['password']),
        role=data.get('role', 'recipient')
    )
    db.session.add(new_user)
    db.session.commit()

    #we will add welcome notification for new user
    welcome_notification = Notification(
        user_id=new_user.id,
        message=f"Welcome to the Local Food Bank Assistance App! Your account has been created successfully."
    )
    db.session.add(welcome_notification)

    # Notify admins about new user
    admin_users = User.query.filter_by(role='admin').all()
    for admin in admin_users:
        admin_notification = Notification(
            user_id=admin.id,
            message=f"New {new_user.role} registered: {new_user.first_name} {new_user.last_name}"
        )
        db.session.add(admin_notification)

    db.session.commit()

    session['user_id'] = new_user.id
    session.permanent = True
    return jsonify({
        'message': 'Registration successful',
        'user': {
            'id': new_user.id,
            'first_name': new_user.first_name,
            'last_name': new_user.last_name,
            'role': new_user.role,
            'is_vip': new_user.is_vip
        }
    }), 201


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(
        first_name=data.get('first_name'),
        last_name=data.get('last_name')
    ).first()

    if user and check_password_hash(user.password, data.get('password', '')):
        session['user_id'] = user.id
        session.permanent = True
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'is_vip': user.is_vip
            }
        }), 200
    return jsonify({'error': 'Invalid credentials'}), 401


@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'message': 'Logged out successfully'}), 200


@app.route('/api/upgrade-to-vip', methods=['POST'])
def upgrade_to_vip():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404

    #we will use a mock payment feature- as real paypal integration is not needed
    user.is_vip = True


    user_notification = Notification(
        user_id=user.id,
        message="Congratulations! You are now a VIP member."
    )
    db.session.add(user_notification)

    #we can add notifications for admin user Sami
    admin_users = User.query.filter_by(role='admin').all()
    for admin in admin_users:
        admin_notification = Notification(
            user_id=admin.id,
            message=f"{user.first_name} {user.last_name} has upgraded to VIP membership."
        )
        db.session.add(admin_notification)

    db.session.commit()

    return jsonify({
        'message': 'Upgrade to VIP successful',
        'user': {
            'id': user.id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'is_vip': user.is_vip
        }
    }), 200


@app.route('/api/request-food', methods=['POST'])
@role_required('recipient')
def request_food():
    data = request.get_json()
    user_id = session['user_id']
    user = User.query.get(user_id)
    print(f"Creating food request for user {user.first_name} {user.last_name} (ID: {user_id})")

    #we can check if any food items were selected
    has_items = False
    for category, items in data.items():
        if items and len(items) > 0:
            has_items = True
            break

    if not has_items:
        return jsonify({'error': 'No items selected'}), 400

    new_request = Request(user_id=user_id)
    db.session.add(new_request)
    db.session.commit()

    print(f"Created request with ID: {new_request.id}")

    for category, items in data.items():
        if items and len(items) > 0:
            for item in items:
                food_item = FoodItem(
                    name=item['name'],
                    category=category,
                    quantity=1,
                    request_id=new_request.id
                )
                db.session.add(food_item)
                print(f"Added {item['name']} to request")

    #we will add notifications for donor users
    donor_users = User.query.filter_by(role='donor').all()
    for donor in donor_users:
        donor_notification = Notification(
            user_id=donor.id,
            message=f"New food request from {user.first_name} {user.last_name} is available."
        )
        db.session.add(donor_notification)

    #we will add notifications for admin user Sami
    admin_users = User.query.filter_by(role='admin').all()
    for admin in admin_users:
        admin_notification = Notification(
            user_id=admin.id,
            message=f"New food request from {user.first_name} {user.last_name} has been submitted."
        )
        db.session.add(admin_notification)

    db.session.commit()
    print(f"Request saved successfully with status: {new_request.status}")
    return jsonify({'message': 'Request submitted', 'request_id': new_request.id}), 201


@app.route('/api/requests', methods=['GET'])
@role_required('donor')
def get_requests():
    """Get available requests for donors to claim"""
    # Most basic approach possible
    print("Donor is requesting available food requests")

    #we will get all requests from the database
    all_requests = Request.query.all()
    print(f"Found {len(all_requests)} total requests in database")

    result = []
    for req in all_requests:

        if req.claimed_by is None:
            print(f"Request {req.id} is not claimed, status: {req.status}")

            #we will get user info
            user = User.query.get(req.user_id)
            if not user:
                print(f"Warning: Request {req.id} has invalid user_id {req.user_id}")
                continue

            # Get items
            items = FoodItem.query.filter_by(request_id=req.id).all()
            if not items:
                print(f"Request {req.id} has no items, skipping")
                continue

            print(f"Adding request {req.id} from {user.first_name} to results")
            result.append({
                'id': req.id,
                'user_name': f"{user.first_name} {user.last_name}",
                'items': [{'name': item.name, 'category': item.category} for item in items],
                'created_at': req.created_at.isoformat(),
                'status': req.status
            })
        else:
            print(f"Request {req.id} is already claimed by user {req.claimed_by}")

    print(f"Returning {len(result)} available requests for donor")
    return jsonify(result)


@app.route('/api/admin/requests', methods=['GET'])
@role_required('admin')
def get_all_requests_admin():
    requests = Request.query.order_by(Request.created_at.desc()).all()
    result = []
    for req in requests:
        user = User.query.get(req.user_id)
        donor = User.query.get(req.claimed_by) if req.claimed_by else None
        items = FoodItem.query.filter_by(request_id=req.id).all()

        result.append({
            'id': req.id,
            'user_name': f"{user.first_name} {user.last_name}" if user else "Unknown",
            'items': [{'name': item.name, 'category': item.category} for item in items],
            'status': req.status,
            'created_at': req.created_at.isoformat(),
            'claimed_at': req.claimed_at.isoformat() if req.claimed_at else None,
            'donor_name': f"{donor.first_name} {donor.last_name}" if donor else None
        })
    return jsonify(result)


@app.route('/api/admin/users', methods=['GET'])
@role_required('admin')
def get_all_users_admin():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([{
        'id': u.id,
        'first_name': u.first_name,
        'last_name': u.last_name,
        'role': u.role,
        'is_vip': u.is_vip,
        'join_date': u.created_at.strftime('%Y-%m-%d')
    } for u in users])


@app.route('/api/approve-request/<int:request_id>', methods=['POST'])
@role_required('admin')
def approve_request(request_id):
    req = Request.query.get(request_id)
    if not req:
        return jsonify({'error': 'Request not found'}), 404

    req.status = 'approved'

    #we will add notifications for recipient
    recipient_notification = Notification(
        user_id=req.user_id,
        message=f"Your food request has been approved by an admin."
    )
    db.session.add(recipient_notification)

    #we will add notifications for donors
    donor_users = User.query.filter_by(role='donor').all()
    for donor in donor_users:
        donor_notification = Notification(
            user_id=donor.id,
            message=f"A new food request has been approved and is available for claiming."
        )
        db.session.add(donor_notification)

    db.session.commit()
    return jsonify({'message': 'Request approved successfully'}), 200


@app.route('/api/decline-request/<int:request_id>', methods=['POST'])
@role_required('admin')
def decline_request(request_id):
    req = Request.query.get(request_id)
    if not req:
        return jsonify({'error': 'Request not found'}), 404

    #we can add notification for recipient before deleting request
    recipient_notification = Notification(
        user_id=req.user_id,
        message=f"Your food request has been declined by an admin."
    )
    db.session.add(recipient_notification)


    FoodItem.query.filter_by(request_id=req.id).delete()

    #so we can delete the request
    db.session.delete(req)
    db.session.commit()
    return jsonify({'message': 'Request declined successfully'}), 200


@app.route('/api/my-requests', methods=['GET'])
@role_required('recipient')
def my_requests():
    user_id = session['user_id']
    user_requests = Request.query.filter_by(user_id=user_id).all()
    result = []
    for req in user_requests:
        items = FoodItem.query.filter_by(request_id=req.id).all()
        donor_name = None
        if req.claimed_by:
            donor = User.query.get(req.claimed_by)
            if donor:
                donor_name = f"{donor.first_name} {donor.last_name}"

        result.append({
            'id': req.id,
            'status': req.status,
            'items': [{'name': item.name, 'category': item.category} for item in items],
            'created_at': req.created_at.isoformat(),
            'claimed_at': req.claimed_at.isoformat() if req.claimed_at else None,
            'donor_name': donor_name
        })
    return jsonify(result)


@app.route('/api/my-claimed-requests', methods=['GET'])
@role_required('donor')
def my_claimed_requests():
    donor_id = session['user_id']
    claimed_requests = Request.query.filter_by(claimed_by=donor_id).all()
    result = []
    for req in claimed_requests:
        items = FoodItem.query.filter_by(request_id=req.id).all()
        user = User.query.get(req.user_id)

        result.append({
            'id': req.id,
            'user_name': f"{user.first_name} {user.last_name}" if user else "Unknown",
            'items': [{'name': item.name, 'category': item.category} for item in items],
            'status': req.status,
            'created_at': req.created_at.isoformat(),
            'claimed_at': req.claimed_at.isoformat() if req.claimed_at else None
        })
    return jsonify(result)


@app.route('/api/claim-request/<int:request_id>', methods=['POST'])
@role_required('donor')
def claim_request(request_id):
    donor_id = session['user_id']
    req = Request.query.get(request_id)
    if not req:
        return jsonify({'error': 'Request not found'}), 404
    if req.claimed_by:
        return jsonify({'error': 'Request already claimed by another donor'}), 400

    #we will allow pending and approved requests to be claimed
    if req.status not in ['pending', 'approved']:
        return jsonify({'error': 'Only pending or approved requests can be claimed'}), 400

    req.claimed_by = donor_id
    req.claimed_at = datetime.utcnow()
    req.status = 'claimed'

    #we will add notifications for our recipient
    donor = User.query.get(donor_id)
    recipient_notification = Notification(
        user_id=req.user_id,
        message=f"Your food request has been claimed by {donor.first_name} {donor.last_name}."
    )
    db.session.add(recipient_notification)

    #we will add notifications for our admin Sami
    admin_users = User.query.filter_by(role='admin').all()
    for admin in admin_users:
        admin_notification = Notification(
            user_id=admin.id,
            message=f"Request #{req.id} has been claimed by {donor.first_name} {donor.last_name}."
        )
        db.session.add(admin_notification)

    db.session.commit()
    return jsonify({'message': 'Request claimed successfully'}), 200


@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    user_id = session['user_id']
    notifications = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()

    return jsonify([{
        'id': n.id,
        'message': n.message,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat()
    } for n in notifications])


@app.route('/api/notifications/mark-read', methods=['POST'])
def mark_notifications_read():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    user_id = session['user_id']
    notification_id = request.json.get('notification_id')

    if notification_id:

        notification = Notification.query.filter_by(id=notification_id, user_id=user_id).first()
        if notification:
            notification.is_read = True
            db.session.commit()
    else:
        #we need to insure all notifications show read
        notifications = Notification.query.filter_by(user_id=user_id, is_read=False).all()
        for notification in notifications:
            notification.is_read = True
        db.session.commit()

    return jsonify({'message': 'Notifications marked as read'}), 200


@app.route('/api/debug/all-requests', methods=['GET'])
def debug_all_requests():
    """Debug endpoint to see all requests in the system"""
    all_requests = Request.query.all()
    result = []
    for req in all_requests:
        user = User.query.get(req.user_id)
        donor = User.query.get(req.claimed_by) if req.claimed_by else None
        items = FoodItem.query.filter_by(request_id=req.id).all()

        result.append({
            'id': req.id,
            'user_id': req.user_id,
            'user_name': f"{user.first_name} {user.last_name}" if user else "Unknown",
            'claimed_by': req.claimed_by,
            'donor_name': f"{donor.first_name} {donor.last_name}" if donor else None,
            'items': [{'name': item.name, 'category': item.category} for item in items],
            'status': req.status,
            'created_at': req.created_at.isoformat(),
            'claimed_at': req.claimed_at.isoformat() if req.claimed_at else None,
        })
    return jsonify(result)


@app.route('/debug/db-info')
def debug_db_info():
    # Get all table names
    inspector = inspect(db.engine)
    table_names = inspector.get_table_names()

    return jsonify({
        'db_path': os.path.abspath(db_path),
        'db_exists': os.path.exists(db_path),
        'tables': table_names,
        'app_config': {
            'SQLALCHEMY_DATABASE_URI': app.config['SQLALCHEMY_DATABASE_URI'],
            'SQLALCHEMY_TRACK_MODIFICATIONS': app.config['SQLALCHEMY_TRACK_MODIFICATIONS']
        }
    })


#we will initialize database
with app.app_context():
    Path("instance").mkdir(exist_ok=True)
    db.create_all()

    if not User.query.filter_by(first_name='Sami', last_name='Meyer').first():
        admin = User(
            first_name='Sami',
            last_name='Meyer',
            password=generate_password_hash('Sami123!'),
            role='admin',
            created_at=datetime.utcnow()
        )
        db.session.add(admin)
        db.session.commit()
        print("Created admin user: Sami Meyer")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)