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
        this.updateGenerateChartsButton();
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
        
        // Generate charts button
        document.getElementById('generateChartsBtn').addEventListener('click', () => this.generateCharts());
        
        // Data backup and restore buttons
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importDataBtn').addEventListener('click', () => this.triggerImport());
        document.getElementById('importFileInput').addEventListener('change', (e) => this.importData(e));
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
        // Profile selection is optional now - names can be extracted from images

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
                    // Use extracted name if available, otherwise fall back to current user
                    const userName = extractedData.extractedName || this.currentUser;
                    const timestamp = extractedData.extractedDate || new Date().toISOString();
                    
                    // Remove metadata from extracted data before storing
                    const { extractedName, extractedDate, ...metrics } = extractedData;
                    
                    // Validate and clean metrics to remove OCR errors
                    const cleanedMetrics = this.validateMetrics(metrics, userName);
                    
                    const dataEntry = {
                        name: userName,
                        timestamp: timestamp,
                        filename: file.name,
                        ...cleanedMetrics
                    };
                    
                    this.data.push(dataEntry);
                    results.push({
                        success: true,
                        filename: file.name,
                        data: extractedData,
                        extractedName: userName,
                        extractedDate: timestamp
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
        const combinedText = lines.join(' ').toLowerCase();
        
        // Extract name from Zepp Life format
        let extractedName = null;
        const namePatterns = [
            /^([a-zA-Z]+(?:\.[a-zA-Z]+)?)\s*$/m,  // Single word names like "Rap", "Ross"
            /^([a-zA-Z]+\.[a-zA-Z]+)\s*$/m       // Names with dots like "roy.canseco"
        ];
        
        for (const pattern of namePatterns) {
            const nameMatch = text.match(pattern);
            if (nameMatch && nameMatch[1] && 
                !['body', 'score', 'progress', 'weight', 'overweight', 'thick', 'set', 'zepp', 'life'].includes(nameMatch[1].toLowerCase())) {
                extractedName = nameMatch[1];
                break;
            }
        }
        
        // Extract date from Zepp Life format
        let extractedDate = null;
        
        // Pattern 1: MM/DD/YYYY format (e.g., "06/12/2024")
        const fullDatePattern = /(\d{2}\/\d{2}\/\d{4})/;
        const fullDateMatch = text.match(fullDatePattern);
        
        if (fullDateMatch) {
            const [, date] = fullDateMatch;
            extractedDate = new Date(date).toISOString();
        } else {
            // Pattern 2: MM/DD with time format (e.g., "01/16 07:07 PM", "03/04 04:08 PM")
            const shortDatePattern = /(\d{2}\/\d{2})\s+(\d{2}:\d{2})\s+(AM|PM)/i;
            const shortDateMatch = text.match(shortDatePattern);
            
            if (shortDateMatch) {
                const [, date, time, ampm] = shortDateMatch;
                const currentYear = new Date().getFullYear();
                extractedDate = new Date(`${currentYear}/${date} ${time} ${ampm}`).toISOString();
            }
        }
        
        // Zepp Life specific patterns for metrics
        const zeppPatterns = {
            bodyFat: /body\s*fat\s*([0-9]+(?:\.[0-9]+)?)\s*%/i,
            muscleMass: /muscle\s*([0-9]+(?:\.[0-9]+)?)\s*kg/i,
            bodyWater: /water\s*([0-9]+(?:\.[0-9]+)?)\s*%/i,
            bmi: /bmi\s*([0-9]+(?:\.[0-9]+)?)/i,
            visceralFat: /visceral\s*fat\s*([0-9]+)/i,
            basalMetabolism: /basal\s*metabolism\s*([0-9,]+)\s*kcal/i,
            protein: /protein\s*([0-9]+(?:\.[0-9]+)?)\s*%/i,
            boneMass: /bone\s*mass\s*([0-9]+(?:\.[0-9]+)?)\s*kg/i
        };

        // Try to match Zepp Life specific patterns first
        for (const [key, pattern] of Object.entries(zeppPatterns)) {
            const match = text.match(pattern);
            if (match) {
                let value = parseFloat(match[1].replace(/,/g, '')); // Remove commas from numbers
                if (!isNaN(value)) {
                    data[key] = value;
                }
            }
        }
        
        // Fallback to general patterns if Zepp Life patterns don't work
        if (Object.keys(data).length === 0) {
            const generalPatterns = {
                bodyFat: /(?:body\s*fat|fat\s*percentage|fat\s*%)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
                muscleMass: /(?:muscle\s*mass|muscle)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
                bodyWater: /(?:body\s*water|water\s*%|water\s*percentage)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
                bmi: /(?:bmi|body\s*mass\s*index)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
                visceralFat: /(?:visceral\s*fat|visceral)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i,
                basalMetabolism: /(?:basal\s*metabolism|metabolism)\s*:?\s*([0-9,]+)(?:\s*kcal)?/i,
                protein: /(?:protein)\s*:?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i,
                boneMass: /(?:bone\s*mass|bone)\s*:?\s*([0-9]+(?:\.[0-9]+)?)\s*kg/i
            };

            for (const [key, pattern] of Object.entries(generalPatterns)) {
                const match = text.match(pattern);
                if (match) {
                    const value = parseFloat(match[1].replace(/,/g, '')); // Remove commas from numbers
                    if (!isNaN(value)) {
                        data[key] = value;
                    }
                }
            }
        }

        // Alternative approach: look for number-unit pairs
        if (Object.keys(data).length === 0) {
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
        }

        // Add extracted name and date to the result
        if (extractedName) {
            data.extractedName = extractedName;
        }
        if (extractedDate) {
            data.extractedDate = extractedDate;
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

    // Validate metrics to remove OCR errors (like missing decimal points)
    validateMetrics(metrics, userName) {
        const cleanedMetrics = {};
        const metricNames = ['bodyFat', 'muscleMass', 'bodyWater', 'bmi', 'visceralFat', 'basalMetabolism', 'protein', 'boneMass'];
        
        // Get previous data for this user to establish baseline ranges
        const userHistory = this.data.filter(entry => entry.name === userName);
        
        for (const [key, value] of Object.entries(metrics)) {
            if (metricNames.includes(key) && typeof value === 'number') {
                let isValid = true;
                
                // Get historical values for this metric
                const historicalValues = userHistory
                    .map(entry => entry[key])
                    .filter(val => val !== undefined && val !== null)
                    .sort((a, b) => a - b);
                
                if (historicalValues.length > 0) {
                    const maxHistorical = Math.max(...historicalValues);
                    const minHistorical = Math.min(...historicalValues);
                    const avgHistorical = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
                    
                    // Reject values that are more than double the previous maximum
                    // or more than 10x the average (for cases with very low historical values)
                    const upperLimit = Math.max(maxHistorical * 2, avgHistorical * 10);
                    
                    // Also set reasonable absolute limits based on metric type
                    const absoluteLimits = {
                        bodyFat: 60,        // Body fat % rarely exceeds 60%
                        muscleMass: 100,    // Muscle mass rarely exceeds 100kg
                        bodyWater: 80,      // Body water % rarely exceeds 80%
                        bmi: 60,            // BMI rarely exceeds 60
                        visceralFat: 30,    // Visceral fat level rarely exceeds 30
                        basalMetabolism: 5000, // Basal metabolism rarely exceeds 5000 kcal
                        protein: 30,        // Protein % rarely exceeds 30%
                        boneMass: 10        // Bone mass rarely exceeds 10kg
                    };
                    
                    const absoluteLimit = absoluteLimits[key] || Infinity;
                    const finalLimit = Math.min(upperLimit, absoluteLimit);
                    
                    if (value > finalLimit) {
                        console.warn(`Rejecting ${key} value ${value} for ${userName} (exceeds limit ${finalLimit.toFixed(1)})`);
                        isValid = false;
                    }
                } else {
                    // For first-time data, use only absolute limits
                    const absoluteLimits = {
                        bodyFat: 60,
                        muscleMass: 100,
                        bodyWater: 80,
                        bmi: 60,
                        visceralFat: 30,
                        basalMetabolism: 5000,
                        protein: 30,
                        boneMass: 10
                    };
                    
                    const absoluteLimit = absoluteLimits[key] || Infinity;
                    if (value > absoluteLimit) {
                        console.warn(`Rejecting ${key} value ${value} for ${userName} (exceeds absolute limit ${absoluteLimit})`);
                        isValid = false;
                    }
                }
                
                if (isValid) {
                    cleanedMetrics[key] = value;
                }
            } else {
                // Keep non-numeric values as-is
                cleanedMetrics[key] = value;
            }
        }
        
        return cleanedMetrics;
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
                    ${result.extractedName ? `<p><strong>Name:</strong> ${result.extractedName}</p>` : ''}
                    ${result.extractedDate ? `<p><strong>Date:</strong> ${new Date(result.extractedDate).toLocaleString()}</p>` : ''}
                    <p><strong>Extracted Data:</strong></p>
                    ${Object.entries(result.data).filter(([key]) => !['extractedName', 'extractedDate'].includes(key)).map(([key, value]) => 
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
            visceralFat: 'Visceral Fat',
            basalMetabolism: 'Basal Metabolism',
            protein: 'Protein',
            boneMass: 'Bone Mass'
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
            visceralFat: '',
            basalMetabolism: 'kcal',
            protein: '%',
            boneMass: 'kg'
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
        this.updateGenerateChartsButton();
        this.updateExportImportButtons();
        // Don't auto-update charts anymore - user controls this with button
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
                <td>${entry.basalMetabolism || '-'}</td>
                <td>${entry.protein || '-'}</td>
                <td>${entry.boneMass || '-'}</td>
                <td>
                    <button class="delete-btn" onclick="window.app.deleteEntry(${index})">Delete</button>
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
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }

        const metrics = ['bodyFat', 'muscleMass', 'bodyWater', 'bmi', 'visceralFat', 'basalMetabolism', 'protein', 'boneMass'];
        
        metrics.forEach(metric => {
            try {
                const ctx = document.getElementById(`${metric}Chart`).getContext('2d');
                this.charts[metric] = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: [],
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
            } catch (error) {
                console.error(`Failed to initialize chart for ${metric}:`, error);
            }
        });
    }

    updateCharts() {
        const metrics = ['bodyFat', 'muscleMass', 'bodyWater', 'bmi', 'visceralFat', 'basalMetabolism', 'protein', 'boneMass'];
        const users = [...new Set(this.data.map(entry => entry.name))];
        
        // Generate colors for each user
        const colors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#c0392b'
        ];
        
        metrics.forEach(metric => {
            const chart = this.charts[metric];
            if (!chart) return;
            
            // Get all unique sorted dates for proper x-axis ordering
            const allTimestamps = [...new Set(this.data.map(entry => entry.timestamp))]
                .sort((a, b) => new Date(a) - new Date(b));
            
            const labels = allTimestamps.map(timestamp => 
                new Date(timestamp).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                })
            );
            
            const datasets = [];
            
            users.forEach((user, userIndex) => {
                const userEntries = this.data
                    .filter(entry => entry.name === user)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                // Create data points aligned with all timestamps
                const dataPoints = allTimestamps.map(timestamp => {
                    const entry = userEntries.find(e => e.timestamp === timestamp);
                    return entry && entry[metric] !== undefined ? entry[metric] : null;
                });
                
                // Only add dataset if user has data for this metric
                const hasData = dataPoints.some(point => point !== null);
                if (hasData) {
                    datasets.push({
                        label: user,
                        data: dataPoints,
                        borderColor: colors[userIndex % colors.length],
                        backgroundColor: colors[userIndex % colors.length] + '20',
                        tension: 0.1,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        spanGaps: true
                    });
                }
            });
            
            chart.data.labels = labels;
            chart.data.datasets = datasets;
            chart.update();
        });
    }

    // Generate charts on demand
    generateCharts() {
        if (this.data.length === 0) {
            alert('No data available to generate charts. Please upload some images first.');
            return;
        }
        this.updateCharts();
    }

    // Update generate charts button state
    updateGenerateChartsButton() {
        const button = document.getElementById('generateChartsBtn');
        if (this.data.length === 0) {
            button.disabled = true;
            button.textContent = 'No Data Available';
        } else {
            button.disabled = false;
            button.textContent = 'Generate Charts';
        }
    }

    // Data backup and restore functions
    exportData() {
        if (this.data.length === 0) {
            alert('No data to export. Please upload some images first.');
            return;
        }

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalEntries: this.data.length,
            data: this.data
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `body-composition-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert(`Successfully exported ${this.data.length} entries to file.`);
    }

    triggerImport() {
        document.getElementById('importFileInput').click();
    }

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedData = JSON.parse(text);
            
            // Validate the imported data structure
            if (!this.validateImportData(importedData)) {
                alert('Invalid file format. Please select a valid backup file.');
                return;
            }

            // Ask user for import strategy
            const strategy = this.getImportStrategy(importedData);
            if (!strategy) return; // User cancelled

            this.processImport(importedData, strategy);
            
        } catch (error) {
            console.error('Import error:', error);
            alert('Error reading file. Please make sure it\'s a valid JSON backup file.');
        }
        
        // Clear the file input
        event.target.value = '';
    }

    validateImportData(data) {
        // Check if it's a valid backup format
        if (!data || typeof data !== 'object') return false;
        if (!data.data || !Array.isArray(data.data)) return false;
        
        // Check if each entry has required fields
        return data.data.every(entry => 
            entry.name && 
            entry.timestamp && 
            typeof entry === 'object'
        );
    }

    getImportStrategy(importedData) {
        const existingCount = this.data.length;
        const importCount = importedData.data.length;
        
        if (existingCount === 0) {
            return confirm(`Import ${importCount} entries from backup?`) ? 'replace' : null;
        }
        
        const choice = prompt(
            `You have ${existingCount} existing entries and want to import ${importCount} entries.\n\n` +
            'Choose import strategy:\n' +
            '1. REPLACE - Delete all existing data and import backup\n' +
            '2. MERGE - Keep existing data and add backup entries\n\n' +
            'Enter 1 for REPLACE or 2 for MERGE (or cancel to abort):'
        );
        
        if (choice === '1') return 'replace';
        if (choice === '2') return 'merge';
        return null;
    }

    processImport(importedData, strategy) {
        const importEntries = importedData.data;
        
        if (strategy === 'replace') {
            this.data = [...importEntries];
            alert(`Successfully replaced all data with ${importEntries.length} imported entries.`);
        } else if (strategy === 'merge') {
            const beforeCount = this.data.length;
            
            // Add imported entries that don't duplicate existing ones
            let duplicateCount = 0;
            importEntries.forEach(importEntry => {
                const isDuplicate = this.data.some(existing => 
                    existing.name === importEntry.name && 
                    existing.timestamp === importEntry.timestamp
                );
                
                if (!isDuplicate) {
                    this.data.push(importEntry);
                } else {
                    duplicateCount++;
                }
            });
            
            const newCount = this.data.length - beforeCount;
            let message = `Successfully imported ${newCount} new entries.`;
            if (duplicateCount > 0) {
                message += ` Skipped ${duplicateCount} duplicate entries.`;
            }
            alert(message);
        }
        
        this.saveData();
        this.updateUI();
        this.updateExportImportButtons();
    }

    updateExportImportButtons() {
        const exportBtn = document.getElementById('exportDataBtn');
        if (this.data.length === 0) {
            exportBtn.disabled = true;
            exportBtn.textContent = 'No Data to Export';
        } else {
            exportBtn.disabled = false;
            exportBtn.textContent = `Export Data (${this.data.length} entries)`;
        }
    }
}

// Initialize the application when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Chart.js to load before initializing
    if (typeof Chart !== 'undefined') {
        app = new BodyCompositionTracker();
        window.app = app; // Make app globally accessible
    } else {
        // Retry after a short delay
        setTimeout(() => {
            app = new BodyCompositionTracker();
            window.app = app;
        }, 1000);
    }
});
