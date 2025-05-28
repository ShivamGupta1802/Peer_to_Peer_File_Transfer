import React, { useState, useRef, useEffect } from 'react';

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function P2PChat() {
  const [chatMessages, setChatMessages] = useState([]); // { type: 'local'|'remote', text }
  const [messageInput, setMessageInput] = useState('');
  const [offerSDP, setOfferSDP] = useState('');
  const [answerSDP, setAnswerSDP] = useState('');
  const [iceCandidatesText, setIceCandidatesText] = useState('');
  const [connectionState, setConnectionState] = useState('new'); // can show 'new', 'connecting', 'connected'

  const localConnection = useRef(null);
  const dataChannel = useRef(null);
  const iceCandidates = useRef([]);

  const chatEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Scroll chat view to bottom when new messages appear
  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Create RTCPeerConnection and setup event handlers
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        iceCandidates.current.push(event.candidate);
        setIceCandidatesText(JSON.stringify(iceCandidates.current, null, 2));
      }
    };

    // If remote data channel received (for answerer)
    pc.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      setupDataChannel();
    };

    localConnection.current = pc;
  };

  // Setup data channel event handlers
  const setupDataChannel = () => {
    const channel = dataChannel.current;

    channel.onopen = () => {
      addMessage('Data channel open! You can start chatting.', 'local');
      setConnectionState('connected');
    };

    channel.onmessage = (event) => {
      addMessage(event.data, 'remote');
    };

    channel.onclose = () => {
      addMessage('Data channel closed.', 'local');
      setConnectionState('new');
    };

    channel.onerror = (error) => {
      addMessage('Data channel error: ' + error, 'local');
    };
  };

  // Add a message to chat
  const addMessage = (text, type) => {
    setChatMessages((msgs) => [...msgs, { text, type }]);
  };

  // Create an offer SDP
  const createOffer = async () => {
    try {
      setConnectionState('connecting');
      if (!localConnection.current) createPeerConnection();

      const pc = localConnection.current;

      // Create data channel (offerer side)
      dataChannel.current = pc.createDataChannel('chat');
      setupDataChannel();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setOfferSDP(JSON.stringify(pc.localDescription, null, 2));
      addMessage('Offer created. Send this to remote peer.', 'local');
    } catch (err) {
      alert('Error creating offer: ' + err.message);
      setConnectionState('new');
    }
  };

  // Set remote description and if needed create answer
  const setRemoteDescription = async () => {
    try {
      const sdp = answerSDP.trim();
      if (!sdp) {
        alert('Please paste SDP here');
        return;
      }
      const desc = JSON.parse(sdp);

      if (!localConnection.current) createPeerConnection();

      await localConnection.current.setRemoteDescription(new RTCSessionDescription(desc));

      addMessage('Remote description set.', 'local');

      if (desc.type === 'offer') {
        // If received offer, create and send answer
        const answer = await localConnection.current.createAnswer();
        await localConnection.current.setLocalDescription(answer);

        setOfferSDP(JSON.stringify(localConnection.current.localDescription, null, 2));
        addMessage('Answer created. Send this to remote peer.', 'local');
      }
    } catch (err) {
      alert('Error setting remote description: ' + err.message);
    }
  };

  // Add remote ICE candidates from JSON array text
  const addRemoteIceCandidates = () => {
    try {
      const candidates = JSON.parse(iceCandidatesText.trim());
      if (!Array.isArray(candidates)) {
        alert('ICE candidates must be a JSON array');
        return;
      }
      candidates.forEach((candidate) => {
        localConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      });
      addMessage('Added remote ICE candidates.', 'local');
    } catch (err) {
      alert('Error adding ICE candidates: ' + err.message);
    }
  };

  // Send chat message over data channel
  const sendMessage = () => {
    if (!dataChannel.current || dataChannel.current.readyState !== 'open') {
      alert('Connection is not open yet.');
      return;
    }
    if (!messageInput.trim()) return;

    dataChannel.current.send(messageInput);
    addMessage(messageInput, 'local');
    setMessageInput('');
  };

  const isConnected = connectionState === 'connected';

  return (
    <div style={styles.container}>
      <h2>Peer-to-Peer Chat Messaging</h2>

      <div style={styles.chat} aria-live="polite" aria-label="Chat messages">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              alignSelf: msg.type === 'local' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.type === 'local' ? '#0078d7' : '#e1e4ea',
              color: msg.type === 'local' ? 'white' : '#333',
            }}
          >
            {msg.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div style={styles.inputContainer}>
        <input
          type="text"
          placeholder="Type your message..."
          disabled={!isConnected}
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          style={styles.messageInput}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
        />
        <button
          onClick={sendMessage}
          disabled={!isConnected || !messageInput.trim()}
          style={styles.sendBtn}
          aria-label="Send message"
        >
          Send
        </button>
      </div>

      <div style={styles.signaling}>
        <label htmlFor="offer">Offer (send to remote peer):</label>
        <textarea
          id="offer"
          rows="6"
          readOnly
          value={offerSDP}
          placeholder="Offer SDP will appear here"
          style={styles.textarea}
        />
        <button onClick={createOffer} style={styles.signalingBtn} disabled={connectionState === 'connecting'}>
          Create Offer
        </button>

        <label htmlFor="answer">Answer (paste remote offer or answer here):</label>
        <textarea
          id="answer"
          rows="6"
          value={answerSDP}
          placeholder="Paste SDP here"
          onChange={(e) => setAnswerSDP(e.target.value)}
          style={styles.textarea}
        />
        <button onClick={setRemoteDescription} style={styles.signalingBtn}>
          Set Remote Description
        </button>

        <label htmlFor="iceCandidates">ICE Candidates (paste remote candidates here):</label>
        <textarea
          id="iceCandidates"
          rows="4"
          value={iceCandidatesText}
          placeholder="Paste ICE candidates here (JSON array)"
          onChange={(e) => setIceCandidatesText(e.target.value)}
          style={styles.textarea}
        />
        <button onClick={addRemoteIceCandidates} style={styles.signalingBtn}>
          Add Remote ICE Candidates
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '20px auto',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    height: '80vh',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  chat: {
    flexGrow: 1,
    overflowY: 'auto',
    padding: 15,
    border: '1px solid #ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column',
  },
  message: {
    marginBottom: 12,
    maxWidth: '70%',
    padding: '8px 14px',
    borderRadius: 12,
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  inputContainer: {
    display: 'flex',
  },
  messageInput: {
    flexGrow: 1,
    padding: '10px 14px',
    fontSize: '1rem',
    borderRadius: '8px 0 0 8px',
    border: '1px solid #ccc',
    outline: 'none',
  },
  sendBtn: {
    padding: '0 20px',
    backgroundColor: '#0078d7',
    border: 'none',
    color: 'white',
    fontWeight: '600',
    fontSize: '1rem',
    cursor: 'pointer',
    borderRadius: '0 8px 8px 0',
  },
  signaling: {
    marginTop: '1rem',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: '0.5rem',
    fontFamily: 'monospace',
  },
  signalingBtn: {
    marginBottom: '1rem',
    padding: '7px 14px',
    fontWeight: '600',
    border: 'none',
    borderRadius: 6,
    backgroundColor: '#0078d7',
    color: 'white',
    cursor: 'pointer',
  },
};

export default P2PChat;
