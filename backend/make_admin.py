from backend.app import app, db, User

with app.app_context():
    # Find Sami's account
    user = User.query.filter_by(username='sami meyer').first()

    if user:
        # Make them admin
        user.role = 'admin'
        db.session.commit()
        print("Sami Meyer is now an admin!")
    else:
        print("Couldn't find Sami Meyer in the database")