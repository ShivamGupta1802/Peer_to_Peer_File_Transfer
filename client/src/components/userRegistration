import React, { useState, useEffect } from 'react';
&nbsp;
&nbsp;

function UserRegistration() {
  const [username, setUsername] = useState('');
  const [registeredUser, setRegisteredUser] = useState(null);
&nbsp;
&nbsp;

  // On component mount, check if a user is already registered in localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('registeredUser');
    if (savedUser) {
      setRegisteredUser(savedUser);
    }
  }, []);
&nbsp;
&nbsp;

  const handleRegister = () => {
    if (username.trim() === '') {
      alert('Please enter your name to register.');
      return;
    }
    localStorage.setItem('registeredUser', username.trim());
    setRegisteredUser(username.trim());
  };
&nbsp;
&nbsp;

  if (registeredUser) {
    return (
      <div style={styles.container}>
        <h2>Welcome, {registeredUser}! You are successfully registered.</h2>
      </div>
    );
  }
&nbsp;
&nbsp;

  return (
    <div style={styles.container}>
      <h2>Register User</h2>
      <input
        type="text"
        value={username}
        placeholder="Enter your name"
        onChange={(e) => setUsername(e.target.value)}
        style={styles.input}
      />
      <button onClick={handleRegister} style={styles.button}>
        Register
      </button>
    </div>
  );
}
&nbsp;
&nbsp;

const styles = {
  container: {
    maxWidth: '320px',
    margin: '3rem auto',
    padding: '2rem 3rem',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    background: '#f9f9f9',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    marginBottom: '1rem',
    fontSize: '1rem',
    borderRadius: '6px',
    border: '2px solid #ddd',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0078d7',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontWeight: '600',
    fontSize: '1rem',
    cursor: 'pointer',
  },
};
&nbsp;
&nbsp;

export default UserRegistration;
