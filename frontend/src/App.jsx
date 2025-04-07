import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [userType, setUserType] = useState('recipient');
  const [requests, setRequests] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [myClaimedRequests, setMyClaimedRequests] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [success, setSuccess] = useState('');
  const [showVipForm, setShowVipForm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load data based on user role
  useEffect(() => {
    if (!loggedIn) return;

    const loadData = async () => {
      setLoading(true);
      try {
        if (user?.role === 'donor') {
          const [pendingRes, claimedRes] = await Promise.all([
            fetch('/api/requests', {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            }),
            fetch('/api/my-claimed-requests', {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            })
          ]);
          if (pendingRes.ok) setRequests(await pendingRes.json());
          if (claimedRes.ok) setMyClaimedRequests(await claimedRes.json());
        }
        else if (user?.role === 'recipient') {
          const res = await fetch('/api/my-requests', {
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          });
          if (res.ok) setMyRequests(await res.json());
        }
        else if (user?.role === 'admin') {
          const [usersRes, requestsRes] = await Promise.all([
            fetch('/api/admin/users', {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            }),
            fetch('/api/admin/requests', {
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            })
          ]);
          if (usersRes.ok) setAllUsers(await usersRes.json());
          if (requestsRes.ok) setRequests(await requestsRes.json());
        }

        // Fetch notifications for all user types
        await fetchNotifications();

      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Set up polling for notifications every 2 minutes
    const notificationInterval = setInterval(fetchNotifications, 120000);

    // Clean up interval on component unmount
    return () => clearInterval(notificationInterval);
  }, [loggedIn, user]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const markAsRead = async (notificationId = null) => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ notification_id: notificationId })
      });

      if (response.ok) {
        await fetchNotifications();
        // Close the notifications panel when marking all as read (when notificationId is null)
        if (notificationId === null) {
          setShowNotifications(false);
        }
      }
    } catch (err) {
      console.error('Failed to mark notifications as read', err);
    }
  };

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.target;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          first_name: form.firstName.value,
          last_name: form.lastName.value,
          password: form.password.value
        })
      });

      const data = await response.json();
      if (response.ok) {
        setLoggedIn(true);
        setUser(data.user);
        showSuccess('Login successful!');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const form = e.target;
    setLoading(true);
    setError('');

    if (form.password.value !== form.confirmPassword.value) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          first_name: form.firstName.value,
          last_name: form.lastName.value,
          password: form.password.value,
          confirm_password: form.confirmPassword.value,
          role: userType
        })
      });

      const data = await response.json();
      if (response.ok) {
        setLoggedIn(true);
        setUser(data.user);
        showSuccess('Registered successfully!');
        setShowRegister(false);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      setLoggedIn(false);
      setUser(null);
      setRequests([]);
      setMyRequests([]);
      setNotifications([]);
      setUnreadCount(0);
      showSuccess('Logged out successfully!');
    } catch (err) {
      setError('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeToVIP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/upgrade-to-vip', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      if (response.ok) {
        setUser(data.user);
        setShowVipForm(false);
        showSuccess('Upgraded to VIP successfully!');
        fetchNotifications();
      } else {
        setError(data.error || 'Upgrade failed');
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (requestId) => {
    if (!window.confirm('Are you sure you want to claim this request?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/claim-request/${requestId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Update both lists
        setRequests(requests.filter(req => req.id !== requestId));

        // Fetch updated claimed requests
        const claimedRes = await fetch('/api/my-claimed-requests', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (claimedRes.ok) {
          setMyClaimedRequests(await claimedRes.json());
        }

        showSuccess('Request claimed successfully!');
        fetchNotifications();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to claim request');
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    if (!window.confirm('Are you sure you want to approve this request?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/approve-request/${requestId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Refresh the admin requests list
        const requestsRes = await fetch('/api/admin/requests', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (requestsRes.ok) {
          setRequests(await requestsRes.json());
        }

        showSuccess('Request approved successfully!');
        fetchNotifications();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to approve request');
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async (requestId) => {
    if (!window.confirm('Are you sure you want to decline this request?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/decline-request/${requestId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        setRequests(requests.filter(req => req.id !== requestId));
        showSuccess('Request declined successfully!');
        fetchNotifications();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to decline request');
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  };

  const handleFoodRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.target);
    const requestData = {
      meats: Array.from(formData.getAll('meats')).map(name => ({ name })),
      vegetables: Array.from(formData.getAll('vegetables')).map(name => ({ name })),
      fruits: Array.from(formData.getAll('fruits')).map(name => ({ name })),
      grains: Array.from(formData.getAll('grains')).map(name => ({ name }))
    };

    try {
      const response = await fetch('/api/request-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        e.target.reset();
        showSuccess('Food request submitted successfully!');
        const res = await fetch('/api/my-requests', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });
        if (res.ok) setMyRequests(await res.json());
        fetchNotifications();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to submit request');
      }
    } catch (err) {
      setError('Network error - please try again');
    } finally {
      setLoading(false);
    }
  };

  if (loggedIn) {
    return (
      <div className="app">
        <div className="header-container">
          <h1>Welcome {user?.first_name}!</h1>
          <div className="header-actions">
            <div className="user-info">
              <p>Role: {user?.role}</p>
              {user?.role !== 'admin' && (
                user?.is_vip ? (
                  <p className="vip-badge">VIP Member</p>
                ) : (
                  <button
                    className="vip-button"
                    onClick={() => setShowVipForm(true)}
                  >
                    Upgrade to VIP
                  </button>
                )
              )}
            </div>

            <div className="notification-container">
              <button
                className="notification-button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && unreadCount > 0) {
                    markAsRead();
                  }
                }}
              >
                Notifications
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notifications-panel">
                  <h3>Notifications</h3>
                  {notifications.length === 0 ? (
                    <p>No notifications</p>
                  ) : (
                    <ul className="notifications-list">
                      {notifications.map(notification => (
                        <li
                          key={notification.id}
                          className={notification.is_read ? 'read' : 'unread'}
                        >
                          <p>{notification.message}</p>
                          <small>{new Date(notification.created_at).toLocaleString()}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                  {notifications.length > 0 && (
                    <button
                      className="mark-read-button"
                      onClick={() => markAsRead()}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
              )}
            </div>

            <button onClick={handleLogout} disabled={loading}>
              {loading ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        {loading && <div className="loading-spinner"></div>}

        {showVipForm && (
          <div className="vip-form">
            <h2>Upgrade to VIP Membership</h2>
            <p>Become a VIP member of the Food Bank App!</p>
            <form onSubmit={handleUpgradeToVIP}>
              <div className="form-group">
                <label>Card Number</label>
                <input type="text" placeholder="1234 5678 9012 3456" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Expiry Date</label>
                  <input type="text" placeholder="MM/YY" required />
                </div>
                <div className="form-group">
                  <label>CVV</label>
                  <input type="text" placeholder="123" required />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" disabled={loading}>
                  {loading ? 'Processing...' : 'Upgrade Now'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowVipForm(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="admin-dashboard">
            <h2>Admin Dashboard</h2>
            <div className="admin-section">
              <h3>All Requests</h3>
              {requests.length === 0 ? (
                <p>No requests found</p>
              ) : (
                <ul className="requests-list">
                  {requests.map(req => (
                    <li key={req.id}>
                      <p><strong>From:</strong> {req.user_name}</p>
                      <p><strong>Items:</strong> {req.items.map(item => item.name).join(', ')}</p>
                      <p><strong>Status:</strong> {req.status}</p>
                      {req.donor_name && <p><strong>Claimed by:</strong> {req.donor_name}</p>}
                      <div className="action-buttons">
                        {req.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(req.id)}>Approve</button>
                            <button className="decline-btn" onClick={() => handleDecline(req.id)}>
                              Decline
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="admin-section">
              <h3>User Management</h3>
              <div className="user-tabs">
                <div>
                  <h4>Recipients</h4>
                  <ul className="user-list">
                    {allUsers.filter(u => u.role === 'recipient').map(user => (
                      <li key={user.id}>
                        {user.first_name} {user.last_name}
                        {user.is_vip && <span className="vip-badge-small">VIP</span>}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Donors</h4>
                  <ul className="user-list">
                    {allUsers.filter(u => u.role === 'donor').map(user => (
                      <li key={user.id}>
                        {user.first_name} {user.last_name}
                        {user.is_vip && <span className="vip-badge-small">VIP</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'recipient' && (
          <div className="dashboard">
            <div className="food-request">
              <h2>Request Food</h2>
              <form onSubmit={handleFoodRequest}>
                <div className="food-category">
                  <h4>Meats</h4>
                  <label><input type="checkbox" name="meats" value="chicken" /> Chicken</label>
                  <label><input type="checkbox" name="meats" value="beef" /> Beef</label>
                </div>

                <div className="food-category">
                  <h4>Vegetables</h4>
                  <label><input type="checkbox" name="vegetables" value="carrots" /> Carrots</label>
                  <label><input type="checkbox" name="vegetables" value="broccoli" /> Broccoli</label>
                </div>

                <div className="food-category">
                  <h4>Fruits</h4>
                  <label><input type="checkbox" name="fruits" value="apples" /> Apples</label>
                  <label><input type="checkbox" name="fruits" value="bananas" /> Bananas</label>
                </div>

                <div className="food-category">
                  <h4>Grains</h4>
                  <label><input type="checkbox" name="grains" value="rice" /> Rice</label>
                  <label><input type="checkbox" name="grains" value="pasta" /> Pasta</label>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>

            <div className="my-requests">
              <h2>My Requests</h2>
              {myRequests.length === 0 ? (
                <p>No requests submitted yet</p>
              ) : (
                <ul className="requests-list">
                  {myRequests.map(req => (
                    <li key={req.id}>
                      <p><strong>Status:</strong> {req.status}</p>
                      <p><strong>Items:</strong> {req.items.map(i => i.name).join(', ')}</p>
                      <p><small>Submitted: {new Date(req.created_at).toLocaleString()}</small></p>
                      {req.donor_name && <p><strong>Claimed by:</strong> {req.donor_name}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {user?.role === 'donor' && (
          <div className="dashboard">
            <div className="available-requests">
              <h2>Available Requests</h2>
              <button
                onClick={() => {
                  // Force refresh of requests
                  fetch('/api/requests', {
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                  })
                    .then(res => res.json())
                    .then(data => {
                      setRequests(data);
                      alert(`Found ${data.length} requests. Check console.`);
                      console.log("Requests data:", data);
                    })
                    .catch(err => {
                      console.error("Error fetching requests:", err);
                      alert("Error fetching requests. Check console.");
                    });
                }}
                className="refresh-btn"
              >
                Refresh Requests
              </button>
              {requests.length === 0 ? (
                <p>No requests available</p>
              ) : (
                <ul className="requests-list">
                  {requests.map(req => (
                    <li key={req.id}>
                      <p><strong>From:</strong> {req.user_name}</p>
                      <p><strong>Items:</strong> {req.items.map(i => i.name).join(', ')}</p>
                      <button onClick={() => handleClaim(req.id)} disabled={loading}>
                        Claim Request
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="claimed-requests">
              <h2>My Claimed Requests</h2>
              {myClaimedRequests.length === 0 ? (
                <p>No requests claimed yet</p>
              ) : (
                <ul className="requests-list">
                  {myClaimedRequests.map(req => (
                    <li key={req.id}>
                      <p><strong>From:</strong> {req.user_name}</p>
                      <p><strong>Items:</strong> {req.items.map(i => i.name).join(', ')}</p>
                      <p><small>Claimed: {new Date(req.claimed_at).toLocaleString()}</small></p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Food Bank App</h1>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      {loading && <div className="loading-spinner"></div>}

      {showRegister ? (
        <div className="auth-form">
          <h2>Register</h2>
          <form onSubmit={handleRegister}>
            <input type="text" name="firstName" placeholder="First Name" required />
            <input type="text" name="lastName" placeholder="Last Name" required />
            <input type="password" name="password" placeholder="Password (8+ chars with uppercase & number)" required />
            <input type="password" name="confirmPassword" placeholder="Confirm Password" required />

            <div className="role-selection">
              <label>
                <input type="radio" checked={userType === 'recipient'} onChange={() => setUserType('recipient')} />
                I need food (Recipient)
              </label>
              <label>
                <input type="radio" checked={userType === 'donor'} onChange={() => setUserType('donor')} />
                I want to help (Donor)
              </label>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
          <button onClick={() => setShowRegister(false)} disabled={loading}>
            Back to Login
          </button>
        </div>
      ) : (
        <div className="auth-form">
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <input type="text" name="firstName" placeholder="First Name" required />
            <input type="text" name="lastName" placeholder="Last Name" required />
            <input type="password" name="password" placeholder="Password" required />
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <button onClick={() => setShowRegister(true)} disabled={loading}>
            Need to Register?
          </button>
        </div>
      )}
    </div>
  );
}

export default App;