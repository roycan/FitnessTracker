// Test data loading
function loadTestData() {
    const testData = [
        {
            "name": "Ross",
            "timestamp": "2025-01-16T11:09:00.000Z",
            "filename": "test1.jpg",
            "bodyFat": 27.9,
            "bmi": 28.4,
            "visceralFat": 12
        },
        {
            "name": "Ross",
            "timestamp": "2025-02-02T08:09:00.000Z",
            "filename": "test2.jpg",
            "bodyFat": 28.1,
            "muscleMass": 55.57,
            "bmi": 28.4,
            "visceralFat": 12
        },
        {
            "name": "Roy",
            "timestamp": "2025-02-12T12:15:00.000Z",
            "filename": "test3.jpg",
            "bodyFat": 29.2,
            "muscleMass": 56.03,
            "bodyWater": 50.5,
            "bmi": 29.5,
            "visceralFat": 14
        },
        {
            "name": "Roy",
            "timestamp": "2025-04-01T01:03:00.000Z",
            "filename": "test4.jpg",
            "bodyFat": 30,
            "muscleMass": 55.42,
            "bodyWater": 50,
            "bmi": 29.5,
            "visceralFat": 14
        }
    ];
    
    localStorage.setItem('bodyCompositionData', JSON.stringify(testData));
    location.reload();
}

// Add test button
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const button = document.createElement('button');
        button.textContent = 'Load Test Data';
        button.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; background: red; color: white; padding: 10px;';
        button.onclick = loadTestData;
        document.body.appendChild(button);
    }, 1000);
});
