import React from 'react';

export type Message = {
  sender: string;
  text: string;
  timestamp?: string;
};

export type DialogBoxProps = {
  messages: Message[];
  localUser?: string;
};

const DialogBox: React.FC<DialogBoxProps> = ({ messages, localUser }) => {
  // Removed noisy debug logging for messages updates

  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 16,
        background: '#fff',
        maxHeight: 394,
        height: 394,
        overflowY: 'auto',
        minWidth: 320,
      }}
    >
      {messages.length === 0 && (
        <div style={{ color: '#888', textAlign: 'center' }}>No conversation yet.</div>
      )}
      {messages.map((msg, idx) => (
        <div
          key={idx}
          style={{
            marginBottom: 12,
            textAlign: msg.sender === localUser ? 'right' : 'left',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: msg.sender === localUser ? '#e0f7fa' : '#f1f1f1',
              borderRadius: 12,
              padding: '8px 14px',
              maxWidth: 220,
              wordBreak: 'break-word',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: 12, color: '#555' }}>{msg.sender}</div>
            <div style={{ fontSize: 15 }}>{msg.text}</div>
            {msg.timestamp && (
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{msg.timestamp}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DialogBox;
