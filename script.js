// --- DOM Element References ---
const fileInput = document.getElementById('csvFileInput');
const statusElement = document.getElementById('status');
const elevationElement = document.getElementById('stationElevation');
const mapContainer = document.getElementById('mapContainer');
const ctx = document.getElementById('tempChart').getContext('2d');
const summaryTableContainer = document.getElementById('summaryTableContainer');
const stationTitleElement = document.getElementById('stationTitle'); // Get reference to H1

// --- Global Chart Variable ---
let tempChart = null; // Variable to hold the chart instance for destruction

// --- Event Listener ---
fileInput.addEventListener('change', handleFileSelect, false);

// --- Main File Handling Function ---
function handleFileSelect(event) {
    statusElement.textContent = 'Reading file...';
    console.clear(); // Clear console for new file load
    console.log("File selected. Reading...");

    // Clear previous outputs from the page
    summaryTableContainer.innerHTML = '';
    elevationElement.textContent = '';
    mapContainer.innerHTML = '';
    stationTitleElement.textContent = 'Weather Station Data'; // <-- RESET TITLE HERE
    if (tempChart) {
        tempChart.destroy(); // Destroy old chart instance if exists
        tempChart = null;
    }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear the canvas area

    const file = event.target.files[0];
    if (!file) {
        statusElement.textContent = 'No file selected.';
        console.log("No file selected by user.");
        return;
    }

    // Use FileReader API to read the file
    const reader = new FileReader();
    reader.onload = (e) => {
        statusElement.textContent = 'Processing data...';
        console.log("File read successfully. Processing content...");
        // Call the main processing function once file is read
        // Pass the filename as a potential fallback title
        parseAndPlotData(e.target.result, file.name);
    };
    reader.onerror = (e) => {
        statusElement.textContent = 'Error reading file!';
        console.error("File could not be read! Code " + e.target.error.code);
        // Ensure title remains default on error
        stationTitleElement.textContent = 'Weather Station Data';
    };
    reader.readAsText(file); // Read the file as text
}

// --- CSV Parsing Helper Function ---
// Handles simple CSV lines, including basic quoting for fields
function parseCsvLine(line) {
    const values = [];
    let currentVal = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            // Handle escaped double quotes ("") inside a quoted field
            if (inQuotes && line[i + 1] === '"') {
                currentVal += '"';
                i++; // Skip the second quote of the pair
            } else {
                inQuotes = !inQuotes; // Toggle the in-quotes state
            }
        } else if (char === ',' && !inQuotes) {
            // If comma is encountered outside quotes, it's a delimiter
            values.push(currentVal.trim()); // Add the accumulated value
            currentVal = ''; // Reset for the next value
        } else {
            // Append the character to the current value
            currentVal += char;
        }
    }
    values.push(currentVal.trim()); // Add the last value after the loop finishes
    return values;
}
// --- End CSV Parsing Helper ---


// --- Main Data Processing and Plotting Function ---
// Added 'filename' parameter
function parseAndPlotData(csvString, filename) {
    // Metadata variables, initialized before the loop
    let stationName = null;
    let stationId = null; // <-- Variable for Station ID
    let stationElevationMeters = null;
    let stationLat = null;
    let stationLon = null;

    try {
        const lines = csvString.trim().split('\n');
        console.log(`Read ${lines.length} lines from CSV (including header).`);
        if (lines.length < 2) throw new Error("CSV file appears to have no data rows.");

        // --- Parse Header Row ---
        const headerLine = lines[0].trim();
        const headers = parseCsvLine(headerLine).map(h => h.replace(/^"|"$/g, ''));
        console.log("Detected Headers:", headers);

        // Find indices of required and optional columns
        const dateIndex = headers.indexOf('DATE');
        const tmaxIndex = headers.indexOf('TMAX');
        const tminIndex = headers.indexOf('TMIN');
        const elevationIndex = headers.indexOf('ELEVATION');
        const latIndex = headers.indexOf('LATITUDE');
        const lonIndex = headers.indexOf('LONGITUDE');
        const nameIndex = headers.indexOf('NAME');
        const stationIdIndex = headers.indexOf('STATION'); // <-- Find STATION index

        // Validate essential columns
        if (dateIndex === -1 || tmaxIndex === -1 || tminIndex === -1) {
            throw new Error(`Could not find required columns (DATE, TMAX, TMIN) in header.`);
        }
        // Warn if optional columns are missing
        if (elevationIndex === -1) console.warn("ELEVATION column not found.");
        if (latIndex === -1) console.warn("LATITUDE column not found.");
        if (lonIndex === -1) console.warn("LONGITUDE column not found.");
        if (nameIndex === -1) console.warn("NAME column not found.");
        if (stationIdIndex === -1) console.warn("STATION column not found."); // <-- Warn if STATION is missing

        console.log(`Column indices - DATE: ${dateIndex}, TMAX: ${tmaxIndex}, TMIN: ${tminIndex}, ELEVATION: ${elevationIndex}, LAT: ${latIndex}, LON: ${lonIndex}, NAME: ${nameIndex}, STATION: ${stationIdIndex}`);

        // --- Parse Data Rows ---
        const parsedData = [];
        let skippedRowCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === "") continue;

            const values = parseCsvLine(line);

            if (values.length < headers.length) {
                 if (skippedRowCount < 5) console.warn(`Skipping row ${i+1} due to incorrect column count (${values.length} vs ${headers.length}): ${line}`);
                 else if (skippedRowCount === 5) console.warn("(Further column count warnings suppressed)");
                 skippedRowCount++;
                 continue;
            }

            // --- Attempt to extract Metadata (if not already found) ---
            // Get Station Name (only if not found yet)
            if (stationName === null && nameIndex !== -1 && values[nameIndex]) {
                let nameValue = values[nameIndex].replace(/^"|"$/g, '').trim();
                if (nameValue) {
                    stationName = nameValue;
                    console.log(`Station Name found on row ${i+1}: ${stationName}`);
                    // DO NOT update H1 here anymore
                } else if (skippedRowCount < 1) { console.warn(`Empty station name value found on row ${i+1}`); }
            }
            // Get Station ID (only if not found yet)
            if (stationId === null && stationIdIndex !== -1 && values[stationIdIndex]) {
                let idValue = values[stationIdIndex].replace(/^"|"$/g, '').trim();
                if (idValue) {
                    stationId = idValue;
                    console.log(`Station ID found on row ${i+1}: ${stationId}`);
                } else if (skippedRowCount < 1) { console.warn(`Empty station ID value found on row ${i+1}`); }
            }
            // Get Elevation (only if not already found)
            if (stationElevationMeters === null && elevationIndex !== -1 && values[elevationIndex]) {
                const elevMeters = parseFloat(values[elevationIndex]);
                if (!isNaN(elevMeters)) {
                    stationElevationMeters = elevMeters;
                    console.log(`Elevation found on row ${i+1}: ${stationElevationMeters} m`);
                } else if (skippedRowCount < 1) {
                    console.warn(`Could not parse elevation value from row ${i+1}: ${values[elevationIndex]}`);
                }
            }
            // Get Latitude (only if not already found)
            if (stationLat === null && latIndex !== -1 && values[latIndex]) {
                const lat = parseFloat(values[latIndex]);
                if (!isNaN(lat)) {
                    stationLat = lat;
                    console.log(`Latitude found on row ${i+1}: ${stationLat}`);
                } else if (skippedRowCount < 1) {
                    console.warn(`Could not parse latitude value from row ${i+1}: ${values[latIndex]}`);
                }
            }
            // Get Longitude (only if not already found)
            if (stationLon === null && lonIndex !== -1 && values[lonIndex]) {
                const lon = parseFloat(values[lonIndex]);
                if (!isNaN(lon)) {
                    stationLon = lon;
                    console.log(`Longitude found on row ${i+1}: ${stationLon}`);
                } else if (skippedRowCount < 1) {
                    console.warn(`Could not parse longitude value from row ${i+1}: ${values[lonIndex]}`);
                }
            }
            // --- End Metadata Extraction Attempt ---

            // Extract and validate essential data for plotting/analysis
            const dateStr = values[dateIndex];
            const tmaxVal = parseFloat(values[tmaxIndex]);
            const tminVal = parseFloat(values[tminIndex]);

            if (dateStr && dateStr.length >= 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(tmaxVal) && !isNaN(tminVal)) {
                parsedData.push({ date: dateStr, tmax: tmaxVal, tmin: tminVal });
            } else {
                if (skippedRowCount < 5) console.warn(`Skipping potentially invalid row ${i + 1} (Check DATE format YYYY-MM-DD or TMAX/TMIN numbers): ${line}`);
                else if (skippedRowCount === 5) console.warn("(Further invalid row warnings suppressed)");
                skippedRowCount++;
            }
        } // End of loop through lines

        console.log(`Parsing complete. Parsed ${parsedData.length} potentially valid data rows. Skipped ${skippedRowCount} rows.`);
        if (parsedData.length === 0) throw new Error("Parsing finished, but no valid data rows were found at all.");


        // --- Set Final Title (AFTER the loop) ---
        let finalTitle = "Weather Station Data"; // Default

        if (stationName && stationId) {
            // Found both Name and ID - Combine them
            finalTitle = `${stationName} (${stationId})`;
            console.log(`Setting title: ${finalTitle}`);
        } else if (stationName) {
            // Found only Name
            finalTitle = stationName;
            console.warn(`Station ID (${headers[stationIdIndex] || 'STATION column'}) not found or missing. Setting title to name only: ${finalTitle}`);
        } else if (stationId) {
            // Found only ID
            finalTitle = `Station (${stationId})`; // Use a generic placeholder
            console.warn(`Station Name (${headers[nameIndex] || 'NAME column'}) not found or missing. Setting title using ID only: ${finalTitle}`);
        } else {
            // Found neither Name nor ID
            if (nameIndex === -1 && stationIdIndex === -1 && filename) {
                // If BOTH columns were missing, use filename as fallback
                finalTitle = filename.replace(/\.csv$/i, ''); // Use filename without .csv extension
                console.warn(`Neither NAME nor STATION column found. Using filename '${finalTitle}' as title.`);
            } else {
                // One or both columns existed but had no valid data, or only one missing & filename not useful
                 finalTitle = "Weather Station Data";
                 console.warn("Could not determine station name or ID from file. Using default title.");
            }
        }
        stationTitleElement.textContent = finalTitle; // <-- SET FINAL TITLE HERE


        // --- Display Static Station Info (Elevation & Map) ---
        // Title is already set (either from data or fallback)
        if (stationElevationMeters !== null) {
            const elevationFeet = stationElevationMeters * 3.28084;
            elevationElement.textContent = `Elevation: ${elevationFeet.toFixed(0)} ft (${stationElevationMeters.toFixed(1)} m)`;
        } else {
            elevationElement.textContent = elevationIndex !== -1 ? 'Elevation: Value missing/invalid in CSV' : 'Elevation: Column not found in CSV';
        }
        if (stationLat !== null && stationLon !== null) {
            displayMap(stationLat, stationLon);
        } else {
            mapContainer.innerHTML = '<p class="map-placeholder">Map coordinates not found in CSV.</p>';
            console.warn("Latitude or Longitude columns/values missing, cannot display map.");
        }


        // --- Filter Data for Chart/Table (July/August 2014+) ---
        console.log("Filtering parsed data for July/August, Year >= 2014...");
        const filteredData = parsedData.filter(item => {
            const year = parseInt(item.date.substring(0, 4), 10);
            const month = parseInt(item.date.substring(5, 7), 10);
            return year >= 2014 && (month === 7 || month === 8);
        });
        console.log(`Found ${filteredData.length} rows matching filter criteria (July/Aug 2014+).`);
        if (filteredData.length === 0) throw new Error("No data found matching the criteria (July/August from 2014 onwards) in the file.");


        // --- Calculate Monthly Averages ---
        console.log("Calculating monthly averages...");
        const monthlySummaries = {}; // Key: 'YYYY-MM'
        filteredData.forEach(item => {
            const yearMonth = item.date.substring(0, 7);
            if (!monthlySummaries[yearMonth]) {
                monthlySummaries[yearMonth] = { sumTmax: 0, count: 0, sumTmin: 0 };
            }
            monthlySummaries[yearMonth].sumTmax += item.tmax;
            monthlySummaries[yearMonth].sumTmin += item.tmin;
            monthlySummaries[yearMonth].count++;
        });
        // Convert summaries object into an array for the table body
        const summaryDataForTableBody = Object.keys(monthlySummaries).map(key => {
            const year = parseInt(key.substring(0, 4), 10);
            const month = parseInt(key.substring(5, 7), 10);
            const data = monthlySummaries[key];
            const count = data.count || 1; // Avoid division by zero
            return {
                year: year,
                month: month,
                avgTmax: data.sumTmax / count,
                avgTmin: data.sumTmin / count
            };
        }).sort((a, b) => a.year - b.year || a.month - b.month); // Sort chronologically
        console.log("Calculated Monthly Summaries for table:", summaryDataForTableBody);


        // --- Calculate Overall Averages for Footer ---
        console.log("Calculating overall July/August averages...");
        const allJulyData = filteredData.filter(d => d.date.substring(5, 7) === '07');
        const allAugustData = filteredData.filter(d => d.date.substring(5, 7) === '08');
        // Helper function to calculate average safely
        const calculateAverage = (dataArray, key) => {
            if (!dataArray || dataArray.length === 0) return null; // Return null if no data
            const sum = dataArray.reduce((acc, item) => acc + item[key], 0);
            return sum / dataArray.length;
        };
        // Calculate overall averages
        const overallAverages = {
            julyTmax: calculateAverage(allJulyData, 'tmax'),
            julyTmin: calculateAverage(allJulyData, 'tmin'),
            augTmax: calculateAverage(allAugustData, 'tmax'),
            augTmin: calculateAverage(allAugustData, 'tmin')
        };
        console.log("Calculated Overall Averages for footer:", overallAverages);


        // --- Display Summary Table ---
        displaySummaryTable(summaryDataForTableBody, overallAverages);


        // --- Chart Generation ---
        // Sort the filtered data for the chart's x-axis
        filteredData.sort((a, b) => new Date(a.date) - new Date(b.date));
        const labels = filteredData.map(item => item.date);
        const tmaxData = filteredData.map(item => item.tmax);
        const tminData = filteredData.map(item => item.tmin);

        console.log("Data ready for charting. Generating chart...");
        // Destroy previous chart instance if it exists
        if (tempChart) {
            tempChart.destroy();
            tempChart = null;
        }
        // Create the new chart
        tempChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Max Temp (°F)',
                        data: tmaxData,
                        borderColor: 'rgb(255, 99, 132)', // Red
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        tension: 0.1,
                        pointRadius: 2,
                        borderWidth: 1.5
                    },
                    {
                        label: 'Min Temp (°F)',
                        data: tminData,
                        borderColor: 'rgb(54, 162, 235)', // Blue
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        tension: 0.1,
                        pointRadius: 2,
                        borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Allow chart height to be controlled by container
                plugins: {
                    title: { display: true, text: 'Daily Max & Min Temperatures (°F)' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: { display: true, title: { display: true, text: 'Date' } },
                    y: { display: true, title: { display: true, text: 'Temperature (°F)' } }
                },
                interaction: { // Improves tooltip performance on hover
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });

        // Update status message on success
        statusElement.textContent = `Chart, summary, and map loaded for ${finalTitle} (${filteredData.length} daily data points displayed).`;
        console.log("Chart generation complete.");
        // --- End Charting ---

    } catch (error) {
        // Display error message to user and console
        statusElement.textContent = `Error processing file: ${error.message}`;
        console.error("Error during parseAndPlotData:", error);
        // Ensure UI is cleared on error
        if (tempChart) { tempChart.destroy(); tempChart = null; }
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        summaryTableContainer.innerHTML = `<p class="error-msg">Could not generate summary: ${error.message}</p>`;
        elevationElement.textContent = ''; // Clear elevation on error too
        mapContainer.innerHTML = '<p class="error-msg">Could not generate map.</p>'; // Clear map on error
        stationTitleElement.textContent = 'Weather Station Data'; // Reset title on error
    }
} // --- End parseAndPlotData Function ---


// --- Function to Display Summary Table ---
function displaySummaryTable(summaryDataBody, overallAverages) {
    // Clear previous table content
    summaryTableContainer.innerHTML = '';

    // Check if there's data for the table body
    if (!summaryDataBody || summaryDataBody.length === 0) {
        summaryTableContainer.innerHTML = '<p>No monthly summary data to display (check filter criteria).</p>';
        return; // Don't proceed if no monthly data
    }

    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Start building table HTML
    let tableHTML = `
        <h3>July/August Average Temperatures</h3>
        <table>
            <thead>
                <tr>
                    <th>Year</th>
                    <th>Month</th>
                    <th>Avg High (°F)</th>
                    <th>Avg Low (°F)</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Add rows for each month/year average
    summaryDataBody.forEach(item => {
        tableHTML += `
            <tr>
                <td>${item.year}</td>
                <td>${monthNames[item.month]}</td>
                <td>${item.avgTmax.toFixed(1)}</td>
                <td>${item.avgTmin.toFixed(1)}</td>
            </tr>
        `;
    });

    // Close the table body
    tableHTML += `</tbody>`;

    // Add table footer for overall averages
    tableHTML += `<tfoot>`;
    let footerContentAdded = false; // Flag to check if footer has content

    // Add Overall July Average row if data exists
    if (overallAverages.julyTmax !== null && overallAverages.julyTmin !== null) {
         tableHTML += `
             <tr class="summary-row">
                 <td colspan="2"><strong>Overall Avg July</strong></td>
                 <td><strong>${overallAverages.julyTmax.toFixed(1)}</strong></td>
                 <td><strong>${overallAverages.julyTmin.toFixed(1)}</strong></td>
             </tr>
         `;
         footerContentAdded = true;
    } else {
         console.log("No overall average data found for July.");
    }

    // Add Overall August Average row if data exists
     if (overallAverages.augTmax !== null && overallAverages.augTmin !== null) {
         tableHTML += `
             <tr class="summary-row">
                 <td colspan="2"><strong>Overall Avg August</strong></td>
                 <td><strong>${overallAverages.augTmax.toFixed(1)}</strong></td>
                 <td><strong>${overallAverages.augTmin.toFixed(1)}</strong></td>
             </tr>
         `;
         footerContentAdded = true;
     } else {
         console.log("No overall average data found for August.");
     }

    // Close the table footer
    tableHTML += `</tfoot>`;

    // Close the table
    tableHTML += `</table>`;

    // Update the container's HTML
    summaryTableContainer.innerHTML = tableHTML;
    console.log("Summary table displayed.");

    // Add a message if the footer couldn't be added but body was
     if (!footerContentAdded && summaryDataBody.length > 0) {
         console.warn("Monthly data displayed, but overall averages could not be calculated (likely no July or August data after filtering).");
     }
}
// --- End Summary Table Function ---


// --- Function to Display Map ---
function displayMap(latitude, longitude) {
    mapContainer.innerHTML = ''; // Clear previous map

    // Calculate bounding box for a reasonable zoom level
    const delta = 0.02; // Adjust for desired initial zoom (smaller = more zoomed in)
    const lon1 = longitude - delta;
    const lat1 = latitude - delta;
    const lon2 = longitude + delta;
    const lat2 = latitude + delta;

    // Construct the OpenStreetMap embed URL with marker
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon1},${lat1},${lon2},${lat2}&layer=mapnik&marker=${latitude},${longitude}`;

    // Create iframe element
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', mapUrl);
    iframe.setAttribute('title', 'Station Location Map');
    iframe.style.border = '0'; // Ensure no border via inline style

    // Append iframe to the map container div
    mapContainer.appendChild(iframe);
    console.log("Map displayed.");
}
// --- End Map Function ---