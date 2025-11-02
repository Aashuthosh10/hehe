// Staff Dashboard JavaScript
class StaffDashboard {
    constructor() {
        this.socket = io();
        this.currentUser = null;
        this.currentCall = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isMuted = false;
        this.isVideoOff = false;
        
        this.initializeElements();
        this.bindEvents();
        this.setupSocketListeners();
    }

    initializeElements() {
        // Login elements
        this.loginSection = document.getElementById('loginSection');
        this.dashboardSection = document.getElementById('dashboardSection');
        this.loginForm = document.getElementById('loginForm');
        this.loginError = document.getElementById('loginError');
        
        // Dashboard elements
        this.staffInfo = document.getElementById('staffInfo');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.waitingCount = document.getElementById('waitingCount');
        this.callQueue = document.getElementById('callQueue');
        this.callHistory = document.getElementById('callHistory');
        
        // Video elements
        this.videoContainer = document.getElementById('videoContainer');
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.callControls = document.getElementById('callControls');
        this.callDecision = document.getElementById('callDecision');
        
        // Control buttons
        this.muteBtn = document.getElementById('muteBtn');
        this.videoBtn = document.getElementById('videoBtn');
        this.endCallBtn = document.getElementById('endCallBtn');
        this.acceptBtn = document.getElementById('acceptBtn');
        this.rejectBtn = document.getElementById('rejectBtn');
        this.callNotes = document.getElementById('callNotes');
        
        // Timetable elements
        this.addTimeSlotBtn = document.getElementById('addTimeSlotBtn');
        this.refreshTimetableBtn = document.getElementById('refreshTimetableBtn');
        this.timetableModal = document.getElementById('timetableModal');
        this.timeSlotForm = document.getElementById('timeSlotForm');
        this.weeklyTimetableContainer = document.getElementById('weeklyTimetableContainer');
        this.academicYear = document.getElementById('academicYear');
        this.semester = document.getElementById('semester');
    }

    bindEvents() {
        // Login form
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Logout
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        
        // Call controls
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.videoBtn.addEventListener('click', () => this.toggleVideo());
        this.endCallBtn.addEventListener('click', () => this.endCall());
        
        // Decision buttons
        this.acceptBtn.addEventListener('click', () => this.makeDecision('accepted'));
        this.rejectBtn.addEventListener('click', () => this.makeDecision('rejected'));
        
        // Timetable controls
        this.addTimeSlotBtn.addEventListener('click', () => this.openTimetableModal());
        this.refreshTimetableBtn.addEventListener('click', () => this.refreshTimetable());
        this.timeSlotForm.addEventListener('submit', (e) => this.handleTimeSlotSubmit(e));
        
        // Modal close events
        const closeBtn = this.timetableModal.querySelector('.close');
        const cancelBtn = document.getElementById('cancelSlotBtn');
        closeBtn.addEventListener('click', () => this.closeTimetableModal());
        cancelBtn.addEventListener('click', () => this.closeTimetableModal());
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.timetableModal) {
                this.closeTimetableModal();
            }
        });
        
        // Timetable tab functionality
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTimetableTab(btn));
        });
    }

    setupSocketListeners() {
        // Login responses
        this.socket.on('staff-login-success', (data) => this.handleLoginSuccess(data));
        this.socket.on('login-error', (data) => this.handleLoginError(data));
        
        // Call management
        this.socket.on('new-call-request', (data) => this.handleNewCall(data));
        this.socket.on('call-started', (data) => this.handleCallStarted(data));
        this.socket.on('call-completed', (data) => this.handleCallCompleted(data));
        
        // Video call signaling
        this.socket.on('offer', (data) => this.handleOffer(data));
        this.socket.on('answer', (data) => this.handleAnswer(data));
        this.socket.on('ice-candidate', (data) => this.handleIceCandidate(data));
        
        // Decision responses
        this.socket.on('decision-saved', (data) => this.handleDecisionSaved(data));
        
        // Initial waiting calls count
        this.socket.on('waiting-calls', (data) => {
            if (this.waitingCount) {
                this.waitingCount.textContent = data.count ?? 0;
            }
        });

        // Error handling
        this.socket.on('error', (data) => this.showNotification(data.message, 'error'));

        // Targeted video call request for this staff
        this.socket.on('video-call-request', (req) => {
            // Show ringing alert and push to queue
            try {
                const audio = new Audio('/ringtone.mp3');
                audio.play().catch(() => {});
            } catch (_) {}
            this.showNotification(req.message || `Incoming video call from ${req.clientName}`, 'success');
            this.addCallToQueue({
                callId: req.requestId,
                clientName: req.clientName || 'Client',
                purpose: `Video call request for you`,
                timestamp: req.requestTime || Date.now()
            });
            this.addLiveCallRequest(req);
            this.updateWaitingCount();
        });

        // Staff accepts targeted video call request
        this.socket.on('call-started', (data) => this.handleCallStarted(data));
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(this.loginForm);
        const email = formData.get('email');
        const password = formData.get('password');

        this.socket.emit('staff-login', { email, password });
    }

    handleLoginSuccess(data) {
        // Support both previous { user } and current { staff } payloads
        this.currentUser = data.user || data.staff || null;
        if (data.token) {
            try {
                localStorage.setItem('token', data.token);
            } catch (_) {}
        }
        this.loginSection.style.display = 'none';
        this.dashboardSection.style.display = 'block';
        if (this.currentUser) {
            this.staffInfo.textContent = `${this.currentUser.name} - ${this.currentUser.department || ''}`;
        }
        
        this.showNotification('Login successful!', 'success');
        this.loadCallHistory();
    }

    handleLoginError(data) {
        this.loginError.textContent = data.message;
        this.loginError.style.display = 'block';
    }

    handleLogout() {
        this.currentUser = null;
        try {
            localStorage.removeItem('token');
        } catch (_) {}
        this.dashboardSection.style.display = 'none';
        this.loginSection.style.display = 'flex';
        this.loginForm.reset();
        this.loginError.style.display = 'none';
        
        if (this.currentCall) {
            this.endCall();
        }
    }

    handleNewCall(data) {
        this.showNotification(`New call from ${data.clientName}`, 'success');
        this.addCallToQueue(data);
        this.updateWaitingCount();
    }

    addCallToQueue(callData) {
        const callItem = document.createElement('div');
        callItem.className = 'call-item';
        callItem.innerHTML = `
            <h3>${callData.clientName}</h3>
            <p>${callData.purpose}</p>
            <div class="time">${new Date(callData.timestamp).toLocaleTimeString()}</div>
            <button class="accept-call-btn" onclick="staffDashboard.acceptCall('${callData.callId}')">
                Accept Call
            </button>
        `;
        
        this.callQueue.appendChild(callItem);
    }

    addLiveCallRequest(req) {
        const panel = document.getElementById('callsRequestList');
        if (!panel) return;
        // Clear empty state
        const empty = panel.querySelector('.empty-state');
        if (empty) empty.remove();
        
        const item = document.createElement('div');
        item.className = 'call-item live';
        item.innerHTML = `
            <h3>${req.clientName || 'Client'}</h3>
            <p>${req.message || 'Incoming video call request'}</p>
            <div class="time">${new Date(req.requestTime || Date.now()).toLocaleTimeString()}</div>
            <button class="accept-call-btn" onclick="staffDashboard.acceptCall('${req.requestId}')">Answer</button>
        `;
        panel.prepend(item);
    }

    async acceptCall(callId) {
        try {
            // If this is a targeted video call request id, respond accordingly
            if (String(callId).startsWith('vcr_')) {
                this.socket.emit('video-call-response', { requestId: callId, accepted: true, staffId: this.currentUser?._id || this.currentUser?.id });
            } else {
                this.socket.emit('accept-call', { callId });
            }
            this.currentCall = { id: callId };
            
            // Initialize video call
            await this.initializeVideoCall();
            
            this.showNotification('Call accepted!', 'success');
        } catch (error) {
            this.showNotification('Failed to accept call', 'error');
        }
    }

    async initializeVideoCall() {
        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            this.localVideo.srcObject = this.localStream;
            this.localVideo.style.display = 'block';
            
            // Setup peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });
            
            // Add local stream
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                this.remoteVideo.srcObject = this.remoteStream;
                this.remoteVideo.style.display = 'block';
            };
            
            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', {
                        target: this.currentCall.clientSocketId,
                        candidate: event.candidate,
                        callId: this.currentCall.id
                    });
                }
            };
            
            // Show call controls
            this.callControls.style.display = 'flex';
            this.callDecision.style.display = 'block';
            
        } catch (error) {
            console.error('Error initializing video call:', error);
            this.showNotification('Failed to initialize video call', 'error');
        }
    }

    handleCallStarted(data) {
        this.currentCall = data;
        this.showNotification('Call started!', 'success');
    }

    handleOffer(data) {
        if (this.peerConnection) {
            this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
                .then(() => this.peerConnection.createAnswer())
                .then(answer => this.peerConnection.setLocalDescription(answer))
                .then(() => {
                    this.socket.emit('answer', {
                        target: data.from,
                        answer: this.peerConnection.localDescription,
                        callId: (this.currentCall && this.currentCall.id) || data.callId
                    });
                });
        }
    }

    handleAnswer(data) {
        if (this.peerConnection) {
            this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    }

    handleIceCandidate(data) {
        if (this.peerConnection) {
            this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isMuted = !audioTrack.enabled;
                this.muteBtn.innerHTML = this.isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
            }
        }
    }

    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isVideoOff = !videoTrack.enabled;
                this.videoBtn.innerHTML = this.isVideoOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
            }
        }
    }

    endCall() {
        if (this.currentCall) {
            this.socket.emit('end-call', { callId: this.currentCall.id });
            this.cleanupCall();
        }
    }

    cleanupCall() {
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        // Reset video elements
        this.localVideo.style.display = 'none';
        this.remoteVideo.style.display = 'none';
        this.callControls.style.display = 'none';
        this.callDecision.style.display = 'none';
        
        // Clear current call
        this.currentCall = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        
        // Show placeholder
        this.videoContainer.innerHTML = `
            <div class="video-placeholder">
                <i class="fas fa-video"></i>
                <h3>No Active Call</h3>
                <p>Accept a call from the queue to start video communication</p>
            </div>
        `;
    }

    makeDecision(decision) {
        if (!this.currentCall) return;
        
        const notes = this.callNotes.value;
        this.socket.emit('call-decision', {
            callId: this.currentCall.id,
            decision,
            notes
        });
        
        this.showNotification(`Decision: ${decision}`, 'success');
        this.cleanupCall();
    }

    handleDecisionSaved(data) {
        this.showNotification(`Call decision saved: ${data.decision}`, 'success');
        this.loadCallHistory();
    }

    handleCallCompleted(data) {
        this.showNotification(`Call completed. Decision: ${data.decision}`, 'success');
        this.cleanupCall();
    }

    async loadCallHistory() {
        try {
            // Check if callHistory element exists
            if (!this.callHistory) {
                console.warn('Call history element not found, skipping call history load');
                return;
            }

            const response = await fetch('/api/calls/my-calls', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const calls = await response.json();
                this.displayCallHistory(calls);
            }
        } catch (error) {
            console.error('Error loading call history:', error);
        }
    }

    displayCallHistory(calls) {
        // Check if callHistory element exists
        if (!this.callHistory) {
            console.warn('Call history element not found, cannot display call history');
            return;
        }

        this.callHistory.innerHTML = '';
        
        if (calls.length === 0) {
            this.callHistory.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clock"></i>
                    <p>No call history</p>
                </div>
            `;
            return;
        }
        
        calls.forEach(call => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${call.decision === 'rejected' ? 'rejected' : ''}`;
            historyItem.innerHTML = `
                <h3>${call.clientId.name}</h3>
                <p>${call.purpose}</p>
                <div class="meta">
                    <span>${new Date(call.createdAt).toLocaleDateString()}</span>
                    <span class="decision-badge ${call.decision}">${call.decision}</span>
                </div>
            `;
            this.callHistory.appendChild(historyItem);
        });
    }

    updateWaitingCount() {
        const count = this.callQueue.children.length;
        this.waitingCount.textContent = count;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        const container = document.getElementById('notificationContainer');
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // ===== TIMETABLE MANAGEMENT METHODS =====

    /**
     * Open the timetable modal
     */
    openTimetableModal() {
        this.timetableModal.style.display = 'block';
        this.loadCurrentTimetable();
    }

    /**
     * Close the timetable modal
     */
    closeTimetableModal() {
        this.timetableModal.style.display = 'none';
        this.timeSlotForm.reset();
    }

    /**
     * Handle time slot form submission
     */
    async handleTimeSlotSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.timeSlotForm);
        const slotData = {
            day: formData.get('day'),
            type: formData.get('type'),
            startTime: formData.get('startTime'),
            endTime: formData.get('endTime'),
            subject: formData.get('subject'),
            room: formData.get('room'),
            class: formData.get('class')
        };

        try {
            await this.addTimeSlot(slotData);
            this.closeTimetableModal();
            this.showNotification('Time slot added successfully!', 'success');
        } catch (error) {
            this.showNotification(`Failed to add time slot: ${error.message}`, 'error');
        }
    }

    /**
     * Add a new time slot to the timetable
     */
    async addTimeSlot(slotData) {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Authentication required');
        }

        // Get current timetable
        const currentTimetable = await this.getCurrentTimetable();
        
        // Add new slot to the appropriate day
        let daySchedule = currentTimetable.schedule.find(s => s.day === slotData.day);
        if (!daySchedule) {
            daySchedule = { day: slotData.day, timeSlots: [] };
            currentTimetable.schedule.push(daySchedule);
        }

        // Add the new time slot
        daySchedule.timeSlots.push({
            startTime: slotData.startTime,
            endTime: slotData.endTime,
            subject: slotData.subject,
            room: slotData.room,
            class: slotData.class,
            type: slotData.type
        });

        // Sort time slots by start time
        daySchedule.timeSlots.sort((a, b) => {
            return this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime);
        });

        // Update timetable in database
        await this.updateTimetable(currentTimetable);
        
        // Refresh display
        this.displayTimetable(currentTimetable);
    }

    /**
     * Get current user's timetable
     */
    async getCurrentTimetable() {
        const token = localStorage.getItem('token');
        if (!token) {
            return this.getEmptyTimetable();
        }

        try {
            const response = await fetch('/api/timetable/my-timetable', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.hasTimetable) {
                    return data.timetable;
                }
            }
        } catch (error) {
            console.error('Error fetching timetable:', error);
        }

        return this.getEmptyTimetable();
    }

    /**
     * Get empty timetable structure
     */
    getEmptyTimetable() {
        return {
            schedule: this.days.map(day => ({ day, timeSlots: [] })),
            officeHours: []
        };
    }

    /**
     * Update timetable in database
     */
    async updateTimetable(timetableData) {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Authentication required');
        }

        const response = await fetch('/api/timetable/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(timetableData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update timetable');
        }

        return await response.json();
    }

    /**
     * Load and display current timetable
     */
    async loadCurrentTimetable() {
        try {
            const timetable = await this.getCurrentTimetable();
            this.displayTimetable(timetable);
            
            // Highlight current day by default
            const currentDay = this.getCurrentDay();
            this.highlightSelectedDay(currentDay);
        } catch (error) {
            console.error('Error loading timetable:', error);
            this.showNotification('Failed to load timetable', 'error');
        }
    }

    /**
     * Display timetable in the UI
     */
    displayTimetable(timetable) {
        if (!timetable || !timetable.schedule) {
            this.weeklyTimetableContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus"></i>
                    <p>No timetable entries yet</p>
                    <p>Click "Add Slot" to create your schedule</p>
                </div>
            `;
            return;
        }

        // Display complete weekly timetable
        this.displayWeeklyTimetable(timetable);
    }

    /**
     * Display complete weekly timetable in tabular format
     */
    displayWeeklyTimetable(timetable) {
        let html = '<div class="weekly-timetable">';
        html += '<h3>Weekly Timetable</h3>';
        html += '<div class="timetable-table">';
        
        // Table header
        html += '<div class="table-header">';
        html += '<div class="time-column">Time</div>';
        this.days.forEach(day => {
            html += `<div class="day-column">${this.capitalizeFirst(day)}</div>`;
        });
        html += '</div>';
        
        // Get all unique time slots across the week
        const allTimeSlots = this.getAllTimeSlots(timetable);
        
        // Create rows for each time slot
        allTimeSlots.forEach(timeSlot => {
            html += '<div class="table-row">';
            html += `<div class="time-column">${timeSlot.startTime} - ${timeSlot.endTime}</div>`;
            
            // For each day, show what's scheduled at this time
            this.days.forEach(day => {
                const daySchedule = timetable.schedule.find(s => s.day === day);
                const slotAtThisTime = daySchedule ? 
                    daySchedule.timeSlots.find(slot => 
                        slot.startTime === timeSlot.startTime && slot.endTime === timeSlot.endTime
                    ) : null;
                
                if (slotAtThisTime) {
                    html += `
                        <div class="day-column has-class ${slotAtThisTime.type}">
                            <div class="class-info">
                                <div class="subject">${slotAtThisTime.subject}</div>
                                <div class="room">${slotAtThisTime.room}</div>
                                <div class="class-name">${slotAtThisTime.class}</div>
                                ${slotAtThisTime.note ? `<div class="note">${slotAtThisTime.note}</div>` : ''}
                            </div>
                            <button class="delete-slot-btn" onclick="staffDashboard.deleteTimeSlot('${day}', ${daySchedule.timeSlots.indexOf(slotAtThisTime)})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                } else {
                    html += '<div class="day-column empty-slot">-</div>';
                }
            });
            
            html += '</div>';
        });
        
        html += '</div>';
        html += '</div>';
        
        this.weeklyTimetableContainer.innerHTML = html;
    }

    /**
     * Get all unique time slots across the week
     */
    getAllTimeSlots(timetable) {
        const timeSlots = new Set();
        
        timetable.schedule.forEach(daySchedule => {
            daySchedule.timeSlots.forEach(slot => {
                timeSlots.add(`${slot.startTime}-${slot.endTime}`);
            });
        });
        
        // Convert to array and sort by start time
        return Array.from(timeSlots)
            .map(timeRange => {
                const [startTime, endTime] = timeRange.split('-');
                return { startTime, endTime };
            })
            .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));
    }

    /**
     * Display schedule for a specific day (kept for backward compatibility)
     */
    displayDaySchedule(timetable, day) {
        const daySchedule = timetable.schedule.find(s => s.day === day);
        
        if (!daySchedule || daySchedule.timeSlots.length === 0) {
            this.timetableContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-day"></i>
                    <p>No classes scheduled for ${this.capitalizeFirst(day)}</p>
                </p>
            `;
            return;
        }

        let html = `<div class="day-schedule">`;
        html += `<h3>${this.capitalizeFirst(day)} Schedule</h3>`;
        
        daySchedule.timeSlots.forEach((slot, index) => {
            html += `
                <div class="time-slot ${slot.type}">
                    <div class="slot-header">
                        <span class="time">${slot.startTime} - ${slot.endTime}</span>
                        <span class="type-badge ${slot.type}">${slot.type}</span>
                    </div>
                    <div class="slot-details">
                        <div class="subject">${slot.subject}</div>
                        <div class="class-room">
                            <span class="class">${slot.class}</span>
                            <span class="room">${slot.room}</span>
                        </div>
                    </div>
                    <button class="delete-slot-btn" onclick="staffDashboard.deleteTimeSlot('${day}', ${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        });
        
        html += `</div>`;
        this.timetableContent.innerHTML = html;
    }

    /**
     * Display office hours
     */
    displayOfficeHours(officeHours) {
        if (!officeHours || officeHours.length === 0) {
            this.officeHoursList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clock"></i>
                    <p>No office hours set</p>
                </div>
            `;
            return;
        }

        let html = '';
        officeHours.forEach((oh, index) => {
            html += `
                <div class="office-hour-item">
                    <div class="oh-day">${this.capitalizeFirst(oh.day)}</div>
                    <div class="oh-time">${oh.startTime} - ${oh.endTime}</div>
                    <div class="oh-location">${oh.location}</div>
                    <button class="delete-oh-btn" onclick="staffDashboard.deleteOfficeHour(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        });
        
        this.officeHoursList.innerHTML = html;
    }

    /**
     * Delete a time slot
     */
    async deleteTimeSlot(day, index) {
        if (!confirm('Are you sure you want to delete this time slot?')) {
            return;
        }

        try {
            const timetable = await this.getCurrentTimetable();
            const daySchedule = timetable.schedule.find(s => s.day === day);
            
            if (daySchedule && daySchedule.timeSlots[index]) {
                daySchedule.timeSlots.splice(index, 1);
                await this.updateTimetable(timetable);
                this.displayTimetable(timetable);
                this.showNotification('Time slot deleted successfully!', 'success');
            }
        } catch (error) {
            this.showNotification(`Failed to delete time slot: ${error.message}`, 'error');
        }
    }

    /**
     * Delete office hour
     */
    async deleteOfficeHour(index) {
        if (!confirm('Are you sure you want to delete this office hour?')) {
            return;
        }

        try {
            const timetable = await this.getCurrentTimetable();
            if (timetable.officeHours[index]) {
                timetable.officeHours.splice(index, 1);
                await this.updateTimetable(timetable);
                this.displayTimetable(timetable);
                this.showNotification('Office hour deleted successfully!', 'success');
            }
        } catch (error) {
            this.showNotification(`Failed to delete office hour: ${error.message}`, 'error');
        }
    }

    /**
     * Get current day name
     */
    getCurrentDay() {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = new Date().getDay();
        return days[today];
    }

    /**
     * Capitalize first letter
     */
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert time to minutes for sorting
     */
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Add days array property
    get days() {
        return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    }

    /**
     * Switch between timetable tabs
     */
    async switchTimetableTab(clickedTab) {
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        clickedTab.classList.add('active');
        
        // Get the selected day
        const selectedDay = clickedTab.dataset.day;
        
        // Load and display complete weekly timetable
        try {
            const timetable = await this.getCurrentTimetable();
            this.displayWeeklyTimetable(timetable);
            
            // Highlight the selected day in the table
            this.highlightSelectedDay(selectedDay);
        } catch (error) {
            console.error('Error switching timetable tab:', error);
            this.showNotification('Failed to load timetable for selected day', 'error');
        }
    }

    /**
     * Highlight the selected day in the weekly timetable
     */
    highlightSelectedDay(selectedDay) {
        // Remove previous highlights
        document.querySelectorAll('.day-column').forEach(col => {
            col.classList.remove('selected-day');
        });
        
        // Add highlight to the selected day column
        const dayIndex = this.days.indexOf(selectedDay);
        if (dayIndex !== -1) {
            const dayColumns = document.querySelectorAll(`.table-row .day-column:nth-child(${dayIndex + 2})`);
            dayColumns.forEach(col => {
                col.classList.add('selected-day');
            });
        }
        

    }

    // ===== NEW MANAGEMENT PANEL METHODS =====



    /**
     * Refresh timetable
     */
    async refreshTimetable() {
        try {
            await this.loadCurrentTimetable();
            this.showNotification('Timetable refreshed successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to refresh timetable', 'error');
        }
    }


}

// Initialize the dashboard when the page loads
let staffDashboard;
document.addEventListener('DOMContentLoaded', () => {
    staffDashboard = new StaffDashboard();
});
