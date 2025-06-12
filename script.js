// Body Composition Tracker Application
class BodyCompositionTracker {
    constructor() {
        this.currentUser = null;
        this.data = this.loadData();
        this.charts = {};
        this.initializeApp();
    }

    // Initialize the application
    initializeApp() {
        this.bindEvents();
        this.updateUI();
        this.initializeCharts();
    }

    // Bind event listeners
    bindEvents() {
        // Profile management
        document.getElementById('selectProfileBtn').addEventListener('click', () => this.selectProfile());
        document.getElementById('switchProfileBtn').addEventListener('click', () => this.switchProfile());
        document.getElementById('userNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.selectProfile();
        });

        // File upload
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Drag and drop
        const uploadArea = document.querySelector('.upload-area');
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // Table filtering
        document.getElementById('filterInput').addEventListener('input', (e) => this.filterTable(e.target.value));
        
        // Clear data
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearAllData());
    }

    // Profile management
    selectProfile() {
        const nameInput = document.getElementById('userNameInput');
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('Please enter a name');
            return;
        }

        this.currentUser = name;
        this.updateProfileUI();
        nameInput.value = '';
    }

    switchProfile() {
        this.currentUser = null;
        this.updateProfileUI();
    }

    updateProfileUI() {
        const profileSection = document.querySelector('.profile-input-group');
        const currentProfileDiv = document.getElementById('currentProfile');
        const currentProfileName = document.getElementById('currentProfileName');

        if (this.currentUser) {
            profileSection.style.display = 'none';
            currentProfileDiv.classList.remove('hidden');
            currentProfileName.textContent = this.currentUser;
        } else {
            profileSection.style.display = 'flex';
            currentProfileDiv.classList.add('hidden');
        }
    }

    // Drag and drop handlers
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.style.backgroundColor = '#f0f8ff';
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.style.backgroundColor = '';
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            this.processFiles(files);
        }
    }

    // File upload handler
    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            this.processFiles(files);
        }
    }

    // Process uploaded files
    async processFiles(files) {
        if (!this.currentUser) {
            alert('Please select a profile first');
            return;
        }

        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            alert('Please select valid image files');
            return;
        }

        this.showProgress(true);
        const results = [];

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            this.updateProgress((i / imageFiles.length) * 100, `Processing ${file.name}...`);
            
            try {
                const extractedData = await this.extractDataFromImage(file);
                if (extractedData) {
                    const dataEntry = {
                        name: this.currentUser,
                        timestamp: new Date().toISOString(),
                        filename: file.name,
                        ...extractedData
                    };
                    
                    this.data.push(dataEntry);
                    results.push({
                        success: true,
                        filename: file.name,
                        data: extractedData
                    });
                } else {
                    results.push({
                        success: false,
                        filename: file.name,
                        error: 'No body composition data found'
                    });
                }
            } catch (error) {
                console.error('Error processing file:', error);
                results.push({
                    success: false,
                    filename: file.name,
                    error: error.message
                });
            }
        }

        this.updateProgress(100, 'Processing complete!');
        this.saveData();
        this.displayResults(results);
        this.updateUI();
        
        // Clear file input
        document.getElementById('imageInput').value = '';
        
        setTimeout(() => this.showProgress(false), 2000);
    }

    // Extract data from image using OCR
    async extractDataFromImage(file) {
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        // Update progress for OCR
                    }
                }
            });

            return this.parseBodyCompositionData(text);
        } catch (error) {
            console.error('OCR Error:', error);
            throw new Error('Failed to extract text from image');
        }
    }

    // Parse body composition data from extracted text
    parseBodyCompositionData(text) {
        const data = {};
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        // Common patterns for body composition metrics
        const patterns = {
            bodyFat: /(?:body\s*fat|fat\s*percentage|fat\s*%)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
            muscleMass: /(?:muscle\s*mass|muscle)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
            bodyWater: /(?:body\s*water|water\s*%|water\s*percentage)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
            bmi: /(?:bmi|body\s*mass\s*index)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
            visceralFat: /(?:visceral\s*fat|visceral)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i
        };

        // Try to match each pattern
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = text.match(pattern);
            if (match) {
                const value = parseFloat(match[1]);
                if (!isNaN(value)) {
                    data[key] = value;
                }
            }
        }

        // Alternative approach: look for number-unit pairs
        const combinedText = lines.join(' ').toLowerCase();
        
        // Look for percentage values
        const percentMatches = combinedText.match(/([0-9]+(?:\.[0-9]+)?)\s*%/g);
        if (percentMatches) {
            percentMatches.forEach(match => {
                const value = parseFloat(match);
                const context = this.getContext(combinedText, match);
                
                if (context.includes('fat') && !data.bodyFat) {
                    data.bodyFat = value;
                } else if (context.includes('water') && !data.bodyWater) {
                    data.bodyWater = value;
                }
            });
        }

        // Look for weight values (kg)
        const weightMatches = combinedText.match(/([0-9]+(?:\.[0-9]+)?)\s*kg/g);
        if (weightMatches) {
            weightMatches.forEach(match => {
                const value = parseFloat(match);
                const context = this.getContext(combinedText, match);
                
                if (context.includes('muscle') && !data.muscleMass) {
                    data.muscleMass = value;
                }
            });
        }

        // Look for BMI values
        const bmiMatches = combinedText.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:bmi|body\s*mass\s*index)/gi);
        if (bmiMatches && !data.bmi) {
            const value = parseFloat(bmiMatches[0]);
            if (value >= 10 && value <= 50) { // Reasonable BMI range
                data.bmi = value;
            }
        }

        // Return data only if we found at least one metric
        return Object.keys(data).length > 0 ? data : null;
    }

    // Get context around a matched value
    getContext(text, match) {
        const index = text.indexOf(match);
        const start = Math.max(0, index - 20);
        const end = Math.min(text.length, index + match.length + 20);
        return text.substring(start, end);
    }

    // Progress bar management
    showProgress(show) {
        const progressContainer = document.getElementById('uploadProgress');
        if (show) {
            progressContainer.classList.remove('hidden');
        } else {
            progressContainer.classList.add('hidden');
        }
    }

    updateProgress(percentage, text) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = text;
    }

    // Display processing results
    displayResults(results) {
        const resultsContainer = document.getElementById('uploadResults');
        const resultsList = document.getElementById('resultsList');
        
        resultsList.innerHTML = '';
        
        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.className = `result-item ${result.success ? '' : 'error'}`;
            
            if (result.success) {
                resultDiv.innerHTML = `
                    <h4>✅ ${result.filename}</h4>
                    <p><strong>Extracted Data:</strong></p>
                    ${Object.entries(result.data).map(([key, value]) => 
                        `<p>${this.formatMetricName(key)}: ${value}${this.getUnit(key)}</p>`
                    ).join('')}
                `;
            } else {
                resultDiv.innerHTML = `
                    <h4>❌ ${result.filename}</h4>
                    <p><strong>Error:</strong> ${result.error}</p>
                `;
            }
            
            resultsList.appendChild(resultDiv);
        });
        
        resultsContainer.classList.remove('hidden');
    }

    // Format metric names for display
    formatMetricName(key) {
        const names = {
            bodyFat: 'Body Fat',
            muscleMass: 'Muscle Mass',
            bodyWater: 'Body Water',
            bmi: 'BMI',
            visceralFat: 'Visceral Fat'
        };
        return names[key] || key;
    }

    // Get unit for metric
    getUnit(key) {
        const units = {
            bodyFat: '%',
            muscleMass: 'kg',
            bodyWater: '%',
            bmi: '',
            visceralFat: ''
        };
        return units[key] || '';
    }

    // Data management
    loadData() {
        try {
            const saved = localStorage.getItem('bodyCompositionData');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading data:', error);
            return [];
        }
    }

    saveData() {
        try {
            localStorage.setItem('bodyCompositionData', JSON.stringify(this.data));
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Error saving data to local storage');
        }
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            this.data = [];
            this.saveData();
            this.updateUI();
        }
    }

    // UI updates
    updateUI() {
        this.updateTable();
        this.updateCharts();
    }

    // Table management
    updateTable() {
        const tableBody = document.getElementById('tableBody');
        const noDataMessage = document.getElementById('noDataMessage');
        
        if (this.data.length === 0) {
            tableBody.innerHTML = '';
            noDataMessage.classList.remove('hidden');
            return;
        }
        
        noDataMessage.classList.add('hidden');
        
        const sortedData = [...this.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        tableBody.innerHTML = sortedData.map((entry, index) => `
            <tr>
                <td>${entry.name}</td>
                <td>${new Date(entry.timestamp).toLocaleDateString()}</td>
                <td>${entry.bodyFat || '-'}</td>
                <td>${entry.muscleMass || '-'}</td>
                <td>${entry.bodyWater || '-'}</td>
                <td>${entry.bmi || '-'}</td>
                <td>${entry.visceralFat || '-'}</td>
                <td>
                    <button class="delete-btn" onclick="app.deleteEntry(${index})">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    deleteEntry(index) {
        if (confirm('Are you sure you want to delete this entry?')) {
            const sortedData = [...this.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const entryToDelete = sortedData[index];
            const originalIndex = this.data.findIndex(entry => 
                entry.timestamp === entryToDelete.timestamp && 
                entry.name === entryToDelete.name
            );
            
            if (originalIndex !== -1) {
                this.data.splice(originalIndex, 1);
                this.saveData();
                this.updateUI();
            }
        }
    }

    filterTable(filterText) {
        const rows = document.querySelectorAll('#tableBody tr');
        const filter = filterText.toLowerCase();
        
        rows.forEach(row => {
            const name = row.cells[0].textContent.toLowerCase();
            if (name.includes(filter)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    // Chart management
    initializeCharts() {
        const metrics = ['bodyFat', 'muscleMass', 'bodyWater', 'bmi', 'visceralFat'];
        
        metrics.forEach(metric => {
            const ctx = document.getElementById(`${metric}Chart`).getContext('2d');
            this.charts[metric] = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `${this.formatMetricName(metric)} Over Time`
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: `${this.formatMetricName(metric)} ${this.getUnit(metric)}`
                            }
                        }
                    }
                }
            });
        });
    }

    updateCharts() {
        const metrics = ['bodyFat', 'muscleMass', 'bodyWater', 'bmi', 'visceralFat'];
        const users = [...new Set(this.data.map(entry => entry.name))];
        
        // Generate colors for each user
        const colors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#c0392b'
        ];
        
        metrics.forEach(metric => {
            const chart = this.charts[metric];
            const datasets = [];
            
            users.forEach((user, userIndex) => {
                const userData = this.data
                    .filter(entry => entry.name === user && entry[metric] !== undefined)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .map(entry => ({
                        x: new Date(entry.timestamp).toLocaleDateString(),
                        y: entry[metric]
                    }));
                
                if (userData.length > 0) {
                    datasets.push({
                        label: user,
                        data: userData,
                        borderColor: colors[userIndex % colors.length],
                        backgroundColor: colors[userIndex % colors.length] + '20',
                        tension: 0.1,
                        fill: false
                    });
                }
            });
            
            chart.data.datasets = datasets;
            chart.update();
        });
    }
}

// Initialize the application when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new BodyCompositionTracker();
});
