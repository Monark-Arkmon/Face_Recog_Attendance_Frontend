import React, { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>
        <button className="modal-button" onClick={onClose}>OK</button>
      </div>
    </div>
  );
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast ${type}`}>
      {message}
    </div>
  );
};

const FaceRecognitionApp = () => {
  const [mode, setMode] = useState('recognize');
  const [name, setName] = useState('');
  const [stream, setStream] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });
  const [toast, setToast] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchAttendance();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const showModal = (title, message) => {
    setModal({ isOpen: true, title, message });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '' });
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      videoRef.current.srcObject = mediaStream;
    } catch (err) {
      showModal('Camera Error', 'Unable to access camera. Please check your permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      videoRef.current.srcObject = null;
    }
  };

  const captureFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg');
    });
  };

  const registerFace = async () => {
    if (!name) {
      showModal('Input Required', 'Please enter a name before registering.');
      return;
    }
  
    if (!stream) {
      showModal('Camera Error', 'Please start the camera first.');
      return;
    }
  
    showToast('Starting registration... Please stay still', 'info');
    
    try {
      const frames = [];
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        showToast(`Capturing image ${i + 1}/5...`, 'info');
        const frame = await captureFrame();
        if (frame instanceof Blob) {
          frames.push(frame);
        }
      }
  
      if (frames.length < 5) {
        showModal('Error', 'Failed to capture all required images. Please try again.');
        return;
      }
  
      const formData = new FormData();
      formData.append('name', name);
      frames.forEach((frame, i) => formData.append('images', frame, `frame${i}.jpg`));
  
      showToast('Processing registration...', 'info');
      
      const response = await fetch('http://localhost:8000/register-face/', {
        method: 'POST',
        body: formData,
      });
  
      const result = await response.json();
      if (response.ok) {
        showModal('Success', result.message);
        setName('');
        await fetchAttendance();
      } else {
        showModal('Registration Error', result.message || 'An error occurred while registering the face.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      showModal('Error', 'An error occurred while registering the face.');
    }
  };

  const fetchAttendance = async () => {
    try {
      const date = new Date().toISOString().split('T')[0];
      const response = await fetch(`http://localhost:8000/attendance/${date}`);
      const data = await response.json();
      if (response.ok) {
        setAttendanceData(data.attendance);
      } else {
        showModal('Error', 'Failed to fetch attendance data.');
      }
    } catch (err) {
      showModal('Error', 'An error occurred while fetching attendance data.');
    }
  };

  useEffect(() => {
    fetchAttendance();
    const intervalId = setInterval(fetchAttendance, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const recognizeFace = async () => {
    try {
      const frame = await captureFrame();
      if (!frame) {
        showModal('Error', 'Failed to capture image.');
        return;
      }
  
      const formData = new FormData();
      formData.append('image', frame);
  
      const response = await fetch('http://localhost:8000/recognize-face/', {
        method: 'POST',
        body: formData,
      });
  
      const result = await response.json();
      if (response.ok && result.results) {
        const names = result.results.filter(r => r.name).map(r => r.name).join(', ');
        
        if (names) {
          showToast(`Attendance recorded for: ${names}`);
          showModal('Success', 'Attendance recorded successfully');
          await fetchAttendance();
        } else {
          showModal('Recognition Error', 'No faces were recognized in the image.');
        }
      } else {
        showModal('Recognition Error', 'No faces were recognized in the image.');
      }
    } catch (err) {
      showModal('Error', 'An error occurred while recognizing the face.');
    }
  };

  return (
    <div className="app-container">
      <div className="content-wrapper">
        <div className="main-card">
          <h1 className="title">Facial Recognition Attendance System</h1>
          <div className="button-group">
            <button
              onClick={() => setMode('recognize')}
              className={`mode-button ${mode === 'recognize' ? 'active' : ''}`}
            >
              Recognize Face
            </button>
            <button
              onClick={() => setMode('register')}
              className={`mode-button ${mode === 'register' ? 'active' : ''}`}
            >
              Register New Face
            </button>
          </div>

          {mode === 'register' && (
            <input
              type="text"
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="name-input"
            />
          )}

          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="video-feed"
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          <div className="action-buttons">
            {!stream ? (
              <button onClick={startCamera} className="start-camera-button">
                <Camera className="camera-icon" />
                Start Camera
              </button>
            ) : (
              <>
                <button onClick={stopCamera} className="stop-camera-button">
                  Stop Camera
                </button>
                <button
                  onClick={mode === 'register' ? registerFace : recognizeFace}
                  className="action-button"
                >
                  {mode === 'register' ? 'Register Face' : 'Take Attendance'}
                </button>
              </>
            )}
        </div>
      </div>

      <div className="attendance-section">
        <h2 className="attendance-title">Today's Attendance</h2>
        <table className="attendance-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {attendanceData.length > 0 ? (
              attendanceData.map((record, index) => (
                <tr key={index}>
                  <td>{record.name}</td>
                  <td>{record.time}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="text-center py-4">No attendance records for today</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default FaceRecognitionApp;