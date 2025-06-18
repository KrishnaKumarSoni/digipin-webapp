// Global variables
let map;
let currentMarker;

// Dynamic API base URL - works for both local development and production
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api/digipin'
    : `${window.location.origin}/api/digipin`;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    bindEventListeners();
    showStatus('Ready! Enter coordinates or use current location.', 'info');
});

// Initialize Leaflet map
function initializeMap() {
    // Default view: India center
    map = L.map('map').setView([20.5937, 78.9629], 5);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add click handler to map
    map.on('click', function(e) {
        updateCoordinates(e.latlng.lat, e.latlng.lng);
        addMarkerToMap(e.latlng.lat, e.latlng.lng, 'Clicked Location');
    });
}

// Bind event listeners
function bindEventListeners() {
    document.getElementById('getCurrentLocation').addEventListener('click', getCurrentLocation);
    document.getElementById('generateDigipin').addEventListener('click', generateDigipin);
    document.getElementById('decodeDigipin').addEventListener('click', decodeDigipin);
    document.getElementById('copyDigipin').addEventListener('click', copyDigipinToClipboard);
    document.getElementById('closeOutput').addEventListener('click', hideOutputPanel);
    
    // Enter key handlers
    document.getElementById('latitude').addEventListener('keypress', handleEnterKey);
    document.getElementById('longitude').addEventListener('keypress', handleEnterKey);
    document.getElementById('digipinInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') decodeDigipin();
    });
}

// Handle Enter key press
function handleEnterKey(e) {
    if (e.key === 'Enter') {
        generateDigipin();
    }
}

// Get current location using geolocation API
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showStatus('Geolocation is not supported by this browser.', 'error');
        return;
    }
    
    showLoading(true);
    showStatus('Getting your location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            updateCoordinates(lat, lng);
            addMarkerToMap(lat, lng, 'Your Current Location');
            map.setView([lat, lng], 15);
            
            showLoading(false);
            showStatus('Location found! Click "Generate DIGIPIN" to continue.', 'success');
        },
        function(error) {
            showLoading(false);
            let errorMsg = 'Unable to get location: ';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg += 'Location access denied by user.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMsg += 'Location request timed out.';
                    break;
                default:
                    errorMsg += 'An unknown error occurred.';
                    break;
            }
            
            showStatus(errorMsg, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Update coordinate input fields
function updateCoordinates(lat, lng) {
    document.getElementById('latitude').value = lat.toFixed(6);
    document.getElementById('longitude').value = lng.toFixed(6);
}

// Add marker to map
function addMarkerToMap(lat, lng, title, digipin = null) {
    // Remove existing marker
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }
    
    // Create custom marker
    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="marker-pin"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });
    
    // Add new marker
    currentMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    
    // Create popup content
    let popupContent = `
        <div class="popup-title">${title}</div>
        <div class="popup-content">
            <strong>Coordinates:</strong><br>
            Latitude: ${lat.toFixed(6)}<br>
            Longitude: ${lng.toFixed(6)}
        </div>
    `;
    
    if (digipin) {
        popupContent += `<div class="popup-digipin">DIGIPIN: ${digipin}</div>`;
    }
    
    currentMarker.bindPopup(popupContent).openPopup();
}

// Generate DIGIPIN from coordinates
async function generateDigipin() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);
    
    // Validate inputs
    if (isNaN(lat) || isNaN(lng)) {
        showStatus('Please enter valid latitude and longitude values.', 'error');
        return;
    }
    
    // Check bounds (India region)
    if (lat < 2.5 || lat > 38.5 || lng < 63.5 || lng > 99.5) {
        showStatus('Coordinates are outside India\'s supported region.', 'error');
        return;
    }
    
    showLoading(true);
    showStatus('Generating DIGIPIN...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/encode?latitude=${lat}&longitude=${lng}`);
        const data = await response.json();
        
        if (response.ok && data.digipin) {
            // Show result in output panel
            showOutputPanel(data.digipin, lat, lng, 'encode');
            
            // Add marker with DIGIPIN
            addMarkerToMap(lat, lng, 'Generated DIGIPIN Location', data.digipin);
            map.setView([lat, lng], 16);
            
            showStatus('DIGIPIN generated successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate DIGIPIN');
        }
    } catch (error) {
        console.error('Error generating DIGIPIN:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Decode DIGIPIN to coordinates
async function decodeDigipin() {
    const digipin = document.getElementById('digipinInput').value.trim();
    
    if (!digipin) {
        showStatus('Please enter a DIGIPIN code to decode.', 'error');
        return;
    }
    
    // Basic DIGIPIN format validation
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{4}$/i.test(digipin)) {
        showStatus('Invalid DIGIPIN format. Expected: XXX-XXX-XXXX', 'error');
        return;
    }
    
    showLoading(true);
    showStatus('Decoding DIGIPIN...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/decode?digipin=${encodeURIComponent(digipin)}`);
        const data = await response.json();
        
        if (response.ok && data.latitude && data.longitude) {
            const lat = parseFloat(data.latitude);
            const lng = parseFloat(data.longitude);
            
            // Update coordinate fields
            updateCoordinates(lat, lng);
            
            // Show result in output panel
            showOutputPanel(digipin, lat, lng, 'decode');
            
            // Add marker and zoom to location
            addMarkerToMap(lat, lng, 'Decoded DIGIPIN Location', digipin);
            map.setView([lat, lng], 16);
            
            showStatus('DIGIPIN decoded successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to decode DIGIPIN');
        }
    } catch (error) {
        console.error('Error decoding DIGIPIN:', error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Copy DIGIPIN to clipboard
async function copyDigipinToClipboard() {
    const digipin = document.getElementById('digipinResult').textContent;
    
    if (!digipin) {
        showStatus('No DIGIPIN to copy.', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(digipin);
        showStatus('DIGIPIN copied to clipboard!', 'success');
        
        // Visual feedback
        const copyBtn = document.getElementById('copyDigipin');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
        
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = digipin;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showStatus('DIGIPIN copied to clipboard!', 'success');
        } catch (err) {
            showStatus('Failed to copy DIGIPIN. Please copy manually.', 'error');
        }
        
        document.body.removeChild(textArea);
    }
}

// Show status message
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    
    // Auto-hide success/info messages after 5 seconds
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'status';
        }, 5000);
    }
}

// Show/hide loading overlay
function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Utility function to validate coordinates
function isValidCoordinate(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
}

// Show output panel with results
function showOutputPanel(digipin, lat, lng, type) {
    const outputPanel = document.getElementById('outputPanel');
    const digipinResult = document.getElementById('digipinResult');
    const resultLat = document.getElementById('resultLat');
    const resultLng = document.getElementById('resultLng');
    
    // Set the DIGIPIN code
    digipinResult.textContent = digipin;
    
    // Set the coordinates
    resultLat.textContent = lat.toFixed(6);
    resultLng.textContent = lng.toFixed(6);
    
    // Show the output panel
    outputPanel.style.display = 'block';
    
    // Scroll to top of output panel on mobile
    if (window.innerWidth <= 768) {
        outputPanel.scrollTop = 0;
    }
}

// Hide output panel
function hideOutputPanel() {
    const outputPanel = document.getElementById('outputPanel');
    outputPanel.style.display = 'none';
}

// Handle API errors gracefully
function handleApiError(error, context) {
    console.error(`${context}:`, error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showStatus('Unable to connect to DIGIPIN API. Make sure the server is running.', 'error');
    } else {
        showStatus(`${context}: ${error.message}`, 'error');
    }
} 