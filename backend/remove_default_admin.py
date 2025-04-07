from backend.app import app, db, User

with app.app_context():
    # Find the default admin account
    default_admin = User.query.filter_by(username='admin').first()

    if default_admin:
        db.session.delete(default_admin)  # Delete it
        db.session.commit()  # Save changes
        print("✅ Default admin account deleted!")
    else:
        print("⚠️ Default admin not found (already deleted?)")