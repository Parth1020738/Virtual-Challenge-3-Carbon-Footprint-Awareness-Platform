/* ==========================================================================
   EcoTrack - Core Application Logic
   ========================================================================== */

// Global State
const state = {
    points: 0,
    level: "Eco Beginner",
    history: [],
    goals: [],
    challengesCompleted: [],
    activePlanCompletedDays: [],
    activePlanCategory: "energy", // Default highest emission category
    currentCalculation: {
        total: 0,
        transport: 0,
        energy: 0,
        food: 0,
        waste: 0,
        score: 100,
        grade: "A+",
        gradeText: ""
    }
};

// Constants & Multipliers
const FACTOR_CAR = 0.171;       // kg CO2 per km
const FACTOR_MOTO = 0.103;      // kg CO2 per km
const FACTOR_BUS = 0.089;       // kg CO2 per km
const FACTOR_TRAIN = 0.035;     // kg CO2 per km
const FACTOR_EV = 0.050;        // kg CO2 per km
const FACTOR_GRID = 0.475;      // kg CO2 per kWh

const DIET_VEG = 1500;          // kg CO2 per year
const DIET_MIX = 2500;          // kg CO2 per year
const DIET_MEAT = 3300;         // kg CO2 per year

const WASTE_LOW = 200;          // kg CO2 per year
const WASTE_MED = 400;          // kg CO2 per year
const WASTE_HIGH = 600;         // kg CO2 per year

// Chart instances
let categoryChart = null;
let historyChart = null;

// Initial Load & Execution
document.addEventListener("DOMContentLoaded", () => {
    loadStateFromStorage();
    initEventListeners();
    updatePointsBadge();
    runCalculator(); // Initial compute with defaults
    renderHistoryTable();
    updateHistoryChart();
    updateGoalsList();
    renderChallenges();
    initScrollReveal();
});

// Scroll Reveal via Intersection Observer
function initScrollReveal() {
    const reveals = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
            }
        });
    }, { threshold: 0.1 });

    reveals.forEach(el => observer.observe(el));
}

// Load persistent local state
function loadStateFromStorage() {
    const savedPoints = localStorage.getItem("ecotrack_points");
    if (savedPoints) state.points = parseInt(savedPoints, 10);

    const savedHistory = localStorage.getItem("ecotrack_history");
    if (savedHistory) state.history = JSON.parse(savedHistory);

    const savedGoals = localStorage.getItem("ecotrack_goals");
    if (savedGoals) state.goals = JSON.parse(savedGoals);

    const savedChallenges = localStorage.getItem("ecotrack_challenges");
    if (savedChallenges) state.challengesCompleted = JSON.parse(savedChallenges);

    const savedPlanDays = localStorage.getItem("ecotrack_plan_days");
    if (savedPlanDays) state.activePlanCompletedDays = JSON.parse(savedPlanDays);

    const savedPlanCategory = localStorage.getItem("ecotrack_plan_category");
    if (savedPlanCategory) state.activePlanCategory = savedPlanCategory;

    calculateLevel();
}

// Save state back to storage
function saveStateToStorage() {
    localStorage.setItem("ecotrack_points", state.points);
    localStorage.setItem("ecotrack_history", JSON.stringify(state.history));
    localStorage.setItem("ecotrack_goals", JSON.stringify(state.goals));
    localStorage.setItem("ecotrack_challenges", JSON.stringify(state.challengesCompleted));
    localStorage.setItem("ecotrack_plan_days", JSON.stringify(state.activePlanCompletedDays));
    localStorage.setItem("ecotrack_plan_category", state.activePlanCategory);
}

// User Level Calculation
function calculateLevel() {
    const pts = state.points;
    if (pts >= 2000) state.level = "Eco Guardian";
    else if (pts >= 1000) state.level = "Eco Hero";
    else if (pts >= 500) state.level = "Eco Champion";
    else if (pts >= 200) state.level = "Eco Explorer";
    else state.level = "Eco Beginner";
}

// Points and Ranks Update
function awardPoints(amount, reason) {
    state.points += amount;
    calculateLevel();
    saveStateToStorage();
    updatePointsBadge();
    showToast(`+${amount} Points! ${reason}`);
}

function updatePointsBadge() {
    document.getElementById("nav-points").textContent = state.points;
    document.getElementById("nav-level").textContent = state.level;
    
    // Update Gamification section level card
    const levelTitle = document.getElementById("game-level-title");
    const levelDesc = document.getElementById("game-level-desc");
    const pointsLabel = document.getElementById("game-points-label");
    const pointsBar = document.getElementById("game-points-bar");
    
    if (levelTitle) levelTitle.textContent = state.level;
    
    let nextThreshold = 200;
    let desc = "0 - 200 Points range. Calculate footprint and accept challenges to advance.";
    if (state.level === "Eco Explorer") {
        nextThreshold = 500;
        desc = "200 - 500 Points range. Active explorer seeking clean options.";
    } else if (state.level === "Eco Champion") {
        nextThreshold = 1000;
        desc = "500 - 1000 Points range. Consistently reducing impact.";
    } else if (state.level === "Eco Hero") {
        nextThreshold = 2000;
        desc = "1000 - 2000 Points range. A champion of green communities.";
    } else if (state.level === "Eco Guardian") {
        nextThreshold = state.points; // Max
        desc = "2000+ Points. Ultimate guardian protecting the climate!";
    }
    
    if (levelDesc) levelDesc.textContent = desc;
    if (pointsLabel) pointsLabel.textContent = `${state.points} / ${nextThreshold} pts`;
    
    const percentage = Math.min(100, Math.round((state.points / (nextThreshold || 200)) * 100));
    if (pointsBar) pointsBar.style.width = `${percentage}%`;
}

// Setup Event Listeners
function initEventListeners() {
    // Slider values update dynamically
    const travelDist = document.getElementById("travel-distance");
    const travelVal = document.getElementById("travel-distance-val");
    travelDist.addEventListener("input", (e) => {
        travelVal.textContent = `${e.target.value} km`;
    });

    // Theme toggler
    const themeBtn = document.getElementById("theme-toggle");
    themeBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        themeBtn.querySelector("i").className = newTheme === "dark" ? "fa-solid fa-sun" : "fa-moon";
    });

    // Hamburger menu toggle
    const menuToggle = document.getElementById("menu-toggle");
    const navLinks = document.getElementById("nav-links");
    menuToggle.addEventListener("click", () => {
        navLinks.classList.toggle("show");
    });

    // Trigger calculation with loader animation
    const calcBtn = document.getElementById("calculate-btn");
    const spinner = document.getElementById("calc-spinner");
    const btnText = document.getElementById("calc-btn-text");
    
    calcBtn.addEventListener("click", () => {
        calcBtn.disabled = true;
        spinner.classList.add("fa-spin");
        btnText.textContent = "Calculating...";
        
        setTimeout(() => {
            runCalculator(true);
            calcBtn.disabled = false;
            spinner.classList.remove("fa-spin");
            btnText.textContent = "Calculate Footprint";
        }, 450);
    });

    // Simulator Sliders listeners
    document.getElementById("sim-car-reduction").addEventListener("input", (e) => {
        document.getElementById("sim-car-reduction-val").textContent = `${e.target.value}%`;
        runSimulator();
    });
    document.getElementById("sim-energy-reduction").addEventListener("input", (e) => {
        document.getElementById("sim-energy-reduction-val").textContent = `${e.target.value}%`;
        runSimulator();
    });
    document.getElementById("sim-veg-toggle").addEventListener("change", runSimulator);
    document.getElementById("sim-recycle-toggle").addEventListener("change", runSimulator);

    // Goal creation
    document.getElementById("goal-form").addEventListener("submit", (e) => {
        e.preventDefault();
        addGoal();
    });

    // Share results
    document.getElementById("share-btn").addEventListener("click", () => {
        const text = `Check out my EcoTrack Sustainability grade: ${state.currentCalculation.grade}! Total footprint: ${state.currentCalculation.total} tons CO2/year. Calculate yours now!`;
        navigator.clipboard.writeText(text).then(() => {
            showToast("Results copied to clipboard!");
        });
    });

    // Export PDF
    document.getElementById("export-btn").addEventListener("click", () => {
        window.print();
    });

    // Reset Data Modals trigger events
    const resetModal = document.getElementById("reset-modal");
    document.getElementById("reset-modal-open-btn").addEventListener("click", () => {
        resetModal.classList.add("show");
        resetModal.setAttribute("aria-hidden", "false");
    });
    document.getElementById("reset-modal-cancel-btn").addEventListener("click", () => {
        resetModal.classList.remove("show");
        resetModal.setAttribute("aria-hidden", "true");
    });
    document.getElementById("reset-modal-confirm-btn").addEventListener("click", () => {
        resetAllData();
        resetModal.classList.remove("show");
        resetModal.setAttribute("aria-hidden", "true");
    });
}

// Display Alerts
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Reset Entire LocalStorage system
function resetAllData() {
    localStorage.clear();
    state.points = 0;
    state.level = "Eco Beginner";
    state.history = [];
    state.goals = [];
    state.challengesCompleted = [];
    state.activePlanCompletedDays = [];
    state.activePlanCategory = "energy";
    state.currentCalculation = {
        total: 0,
        transport: 0,
        energy: 0,
        food: 0,
        waste: 0,
        score: 100,
        grade: "A+",
        gradeText: ""
    };
    
    updatePointsBadge();
    runCalculator(false);
    renderHistoryTable();
    updateHistoryChart();
    updateGoalsList();
    renderChallenges();
    showToast("All EcoTrack platform data successfully reset.");
}

// Calculate carbon footprint
function runCalculator(saveToHistory = false) {
    const distanceVal = parseFloat(document.getElementById("travel-distance").value);
    const vehicleType = document.getElementById("vehicle-type").value;
    const electricityVal = parseFloat(document.getElementById("electricity-usage").value) || 0;
    const foodHabit = document.getElementById("food-habit").value;
    const wasteGen = document.getElementById("waste-generation").value;

    // Calculate Transportation (annual emissions in kg)
    let vehicleMultiplier = FACTOR_CAR;
    if (vehicleType === "motorcycle") vehicleMultiplier = FACTOR_MOTO;
    else if (vehicleType === "bus") vehicleMultiplier = FACTOR_BUS;
    else if (vehicleType === "train") vehicleMultiplier = FACTOR_TRAIN;
    else if (vehicleType === "ev") vehicleMultiplier = FACTOR_EV;
    const transportEmissions = distanceVal * 365 * vehicleMultiplier;

    // Energy emissions (annual in kg)
    const energyEmissions = electricityVal * 12 * FACTOR_GRID;

    // Diet emissions
    let foodEmissions = DIET_MIX;
    if (foodHabit === "vegetarian") foodEmissions = DIET_VEG;
    else if (foodHabit === "heavy-meat") foodEmissions = DIET_MEAT;

    // Waste emissions
    let wasteEmissions = WASTE_MED;
    if (wasteGen === "low") wasteEmissions = WASTE_LOW;
    else if (wasteGen === "high") wasteEmissions = WASTE_HIGH;

    // Total and score calculations
    const totalKg = transportEmissions + energyEmissions + foodEmissions + wasteEmissions;
    const totalTons = (totalKg / 1000).toFixed(2);
    
    // Scale score non-linearly: 25,000 kg is 0 score
    const score = Math.max(1, Math.min(100, Math.round(100 * (1 - (totalKg / 25000)))));

    // Assign grades
    let grade = "C";
    let gradeText = "Your emissions are standard, room to optimize consumption.";
    if (totalKg < 3000) {
        grade = "A+";
        gradeText = "Excellent - Carbon neutral range. Keep it up!";
    } else if (totalKg < 5000) {
        grade = "A";
        gradeText = "Very Good - Well below global average emissions.";
    } else if (totalKg < 8000) {
        grade = "B";
        gradeText = "Good - Healthy choices, lower footprint than standard.";
    } else if (totalKg < 12000) {
        grade = "C";
        gradeText = "Average - Standard profile, room to optimize consumption.";
    } else if (totalKg < 18000) {
        grade = "D";
        gradeText = "Needs Improvement - Elevated emissions levels.";
    } else {
        grade = "F";
        gradeText = "High Impact - Heavy carbon output. Take immediate action.";
    }

    state.currentCalculation = {
        total: parseFloat(totalTons),
        transport: parseFloat((transportEmissions / 1000).toFixed(2)),
        energy: parseFloat((energyEmissions / 1000).toFixed(2)),
        food: parseFloat((foodEmissions / 1000).toFixed(2)),
        waste: parseFloat((wasteEmissions / 1000).toFixed(2)),
        score: score,
        grade: grade,
        gradeText: gradeText
    };

    // Find highest emission category to build personalized plan
    const categoriesMap = {
        transport: transportEmissions,
        energy: energyEmissions,
        food: foodEmissions,
        waste: wasteEmissions
    };
    let highestCat = "energy";
    let maxEmissions = 0;
    for (const cat in categoriesMap) {
        if (categoriesMap[cat] > maxEmissions) {
            maxEmissions = categoriesMap[cat];
            highestCat = cat;
        }
    }
    
    if (highestCat !== state.activePlanCategory) {
        state.activePlanCategory = highestCat;
        state.activePlanCompletedDays = [];
        saveStateToStorage();
    }

    // Save calculation to history
    if (saveToHistory) {
        const record = {
            id: Date.now(),
            date: new Date().toLocaleDateString(),
            total: parseFloat(totalTons),
            transport: state.currentCalculation.transport,
            energy: state.currentCalculation.energy,
            food: state.currentCalculation.food,
            waste: state.currentCalculation.waste,
            score: score,
            grade: grade
        };
        state.history.push(record);
        awardPoints(50, "for calculating your carbon footprint");
        saveStateToStorage();
        renderHistoryTable();
        updateHistoryChart();
    }

    updateDashboardUI();
    runSimulator();
    renderRecommendations();
    render7DayPlan();
}

// Update the visual components of Dashboard
function updateDashboardUI() {
    const calc = state.currentCalculation;
    
    // Animated counter on total tons
    animateCounter("val-total", 0, calc.total, 2);
    
    // Circular Gauge update
    document.getElementById("score-number").textContent = calc.score;
    const offset = 377 - (377 * calc.score) / 100;
    document.getElementById("score-ring").style.strokeDashoffset = offset;
    
    // Set grade badge
    const badge = document.getElementById("grade-badge");
    badge.textContent = calc.grade;
    badge.className = `grade-badge grade-${calc.grade.toLowerCase().replace("+", "")}`;
    document.getElementById("grade-desc").textContent = `Grade ${calc.grade} - ${calc.gradeText}`;

    // Global Average Comparison Update (benchmark 4.8 tons)
    const averageBenchmark = 4.80;
    document.getElementById("compare-user-val").textContent = `${calc.total.toFixed(2)} Tons`;
    const compareBar = document.getElementById("compare-bar");
    const compareMessage = document.getElementById("compare-message");
    
    const ratioWidth = Math.min(100, Math.round((calc.total / 9.6) * 100));
    compareBar.style.width = `${ratioWidth}%`;

    if (calc.total < averageBenchmark) {
        const percentageBetter = Math.round(((averageBenchmark - calc.total) / averageBenchmark) * 100);
        compareBar.style.backgroundColor = "var(--primary)";
        compareMessage.innerHTML = `<span style="color: var(--primary);"><i class="fa-solid fa-circle-check"></i> You are ${percentageBetter}% below the global average. Excellent work!</span>`;
    } else {
        const percentageWorse = Math.round(((calc.total - averageBenchmark) / averageBenchmark) * 100);
        compareBar.style.backgroundColor = "var(--color-f)";
        compareMessage.innerHTML = `<span style="color: var(--color-f);"><i class="fa-solid fa-circle-xmark"></i> You are ${percentageWorse}% above the global average. Optimize your plan!</span>`;
    }

    // Update impact converter
    const trees = Math.round((calc.total * 1000) / 22);
    const km = Math.round((calc.total * 1000) / FACTOR_CAR);
    const phones = Math.round((calc.total * 1000) / 0.006);
    const homeDays = Math.round((calc.total * 1000) / (FACTOR_GRID * 15)); // typical household days

    animateCounter("impact-trees", 0, trees, 0);
    animateCounter("impact-km", 0, km, 0);
    animateCounter("impact-phones", 0, phones, 0);
    animateCounter("impact-home", 0, homeDays, 0);

    // Refresh Chart.js
    renderDoughnutChart(calc);
}

// Smooth Number Counter Animation
function animateCounter(id, start, end, decimals) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let current = start;
    const duration = 800;
    const range = end - start;
    const minTimer = 50;
    let stepTime = Math.abs(Math.floor(duration / (range || 1)));
    stepTime = Math.max(stepTime, minTimer);
    
    const startTime = new Date().getTime();
    const endTime = startTime + duration;
    let timer;
    
    function run() {
        const now = new Date().getTime();
        const remaining = Math.max((endTime - now) / duration, 0);
        const value = end - (remaining * range);
        obj.textContent = value.toFixed(decimals);
        if (value == end) {
            clearInterval(timer);
        }
    }
    timer = setInterval(run, stepTime);
    run();
}

// Category breakdown Doughnut Chart
function renderDoughnutChart(calc) {
    const ctx = document.getElementById("categoryChart").getContext("2d");
    const data = [calc.transport, calc.energy, calc.food, calc.waste];
    const labels = ["Transportation", "Energy", "Food Habits", "Waste"];
    const colors = ["#06b6d4", "#10b981", "#84cc16", "#eab308"];

    if (categoryChart) {
        categoryChart.data.datasets[0].data = data;
        categoryChart.update();
    } else {
        categoryChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            color: "#94a3b8"
                        }
                    }
                }
            }
        });
    }
}

// Simulator Updates
function runSimulator() {
    const calc = state.currentCalculation;
    const transportReduce = parseFloat(document.getElementById("sim-car-reduction").value) / 100;
    const energyReduce = parseFloat(document.getElementById("sim-energy-reduction").value) / 100;
    const vegToggle = document.getElementById("sim-veg-toggle").checked;
    const recycleToggle = document.getElementById("sim-recycle-toggle").checked;

    // Simulate adjustments
    const simTrans = calc.transport * (1 - transportReduce);
    const simEnergy = calc.energy * (1 - energyReduce);
    const simFood = vegToggle ? (DIET_VEG / 1000) : calc.food;
    const simWaste = recycleToggle ? (WASTE_LOW / 1000) : calc.waste;

    const simTotal = simTrans + simEnergy + simFood + simWaste;
    const savings = Math.max(0, calc.total - simTotal);
    const savingPercent = calc.total > 0 ? Math.round((savings / calc.total) * 100) : 0;

    document.getElementById("sim-footprint-val").textContent = `${simTotal.toFixed(2)} Tons`;
    document.getElementById("sim-saving-badge").textContent = `${savingPercent}% Saved`;
}

// Upgrade dynamic recommendations sorting by impact
function renderRecommendations() {
    const calc = state.currentCalculation;
    const container = document.getElementById("recommendations-list");
    container.innerHTML = "";

    const allRecommendations = [
        {
            title: "Transition to public transit, walk, or bicycle",
            category: "transport",
            impact: "High",
            savings: 1.2,
            difficulty: "Medium",
            desc: "Replacing driving with cycling or trains reduces commuter emissions significantly.",
            trigger: calc.transport > 1.5
        },
        {
            title: "Switch to LED home fixtures & smart power boards",
            category: "energy",
            impact: "Medium",
            savings: 0.4,
            difficulty: "Low",
            desc: "Efficient lighting saves energy and cuts monthly utility bills.",
            trigger: calc.energy > 1.0
        },
        {
            title: "Establish a backyard compost bin",
            category: "waste",
            impact: "Medium",
            savings: 0.3,
            difficulty: "Low",
            desc: "Prevents organic waste from generating methane in closed landfills.",
            trigger: calc.waste > 0.3
        },
        {
            title: "Adopt Meat-Free days weekly",
            category: "food",
            impact: "High",
            savings: 0.8,
            difficulty: "Low",
            desc: "Reducing red meat consumption helps minimize deforestation for pasture land.",
            trigger: calc.food > 2.0
        },
        {
            title: "Install solar panels or purchase renewable grid energy",
            category: "energy",
            impact: "High",
            savings: 1.8,
            difficulty: "High",
            desc: "Powering your household via clean solar creates direct offset opportunities.",
            trigger: calc.energy > 1.5
        }
    ];

    // Filter and sort by highest potential carbon savings
    const activeRecs = allRecommendations
        .filter(r => r.trigger)
        .sort((a, b) => b.savings - a.savings);

    if (activeRecs.length === 0) {
        container.innerHTML = `<div class="glass-card" style="text-align:center;">Great job! You have very low emissions. Keep maintaining your green choices!</div>`;
        return;
    }

    activeRecs.forEach(rec => {
        const div = document.createElement("div");
        div.className = "glass-card rec-card";
        div.innerHTML = `
            <div class="rec-info">
                <span class="impact-badge impact-${rec.impact === 'High' ? 'high' : rec.impact === 'Medium' ? 'med' : 'low'}">${rec.impact} Impact</span>
                <div>
                    <h4 style="font-family:var(--font-heading); font-size:1.1rem;">${rec.title}</h4>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">${rec.desc}</p>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="font-weight:700; color:var(--primary); font-size:1.1rem;">-${rec.savings} Tons</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">Diff: ${rec.difficulty}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

// 7-Day Plan data generators
function render7DayPlan() {
    const category = state.activePlanCategory;
    const planHeading = document.getElementById("plan-type-heading");
    const container = document.getElementById("plan-days-container");
    container.innerHTML = "";

    const plans = {
        transport: [
            "Walk or bike for journeys under 2 km.",
            "Utilize local train/bus routes instead of driving.",
            "Arrange carpool options with coworkers.",
            "Verify car tire pressure to optimize fuel use.",
            "Avoid rapid acceleration and braking.",
            "Perform all errands in a single unified route.",
            "Work from home if option is open."
        ],
        energy: [
            "De-energize stand-by gadgets and appliances.",
            "Wash laundry in cold temperature cycles.",
            "Hang clothes to dry instead of using the dryer.",
            "Lower climate control settings by 2 degrees.",
            "Unplug power supplies when devices are fully charged.",
            "Utilize natural light instead of switching on bulbs.",
            "Power off unused background monitors."
        ],
        food: [
            "Designate today for completely plant-based foods.",
            "Source food products grown locally.",
            "Incorporate leftovers to eliminate food waste.",
            "Cook double portions and freeze options to save grid cooking energy.",
            "Avoid processed and plastic-packaged goods.",
            "Drink tap water from a reusable flask.",
            "Compost food preparation waste."
        ],
        waste: [
            "Decline single-use plastic carrier bags.",
            "Bring custom reusable mug to local cafes.",
            "Recycle and sorting containers cleanly.",
            "Opt-in to electronic/paperless invoice options.",
            "Buy dried food items in wholesale quantities.",
            "Refurbish, reuse, or mend old garments.",
            "Support local zero-waste retail shops."
        ]
    };

    const activeTasks = plans[category] || plans.energy;
    planHeading.textContent = `${category.toUpperCase()} focused action plan`;

    activeTasks.forEach((task, index) => {
        const isCompleted = state.activePlanCompletedDays.includes(index);
        const dayDiv = document.createElement("div");
        dayDiv.className = `glass-card day-card ${isCompleted ? 'completed' : ''}`;
        dayDiv.innerHTML = `
            <div class="day-header">
                <span>Day ${index + 1}</span>
                <input type="checkbox" id="plan-day-${index}" ${isCompleted ? 'checked' : ''} onchange="togglePlanDay(${index})">
            </div>
            <p style="font-size:0.9rem; margin-top:5px;">${task}</p>
        `;
        container.appendChild(dayDiv);
    });

    updatePlanProgressBar();
}

window.togglePlanDay = function(dayIndex) {
    const isChecked = document.getElementById(`plan-day-${dayIndex}`).checked;
    if (isChecked) {
        if (!state.activePlanCompletedDays.includes(dayIndex)) {
            state.activePlanCompletedDays.push(dayIndex);
            awardPoints(20, `for completing Day ${dayIndex + 1} action!`);
        }
    } else {
        state.activePlanCompletedDays = state.activePlanCompletedDays.filter(d => d !== dayIndex);
    }
    saveStateToStorage();
    render7DayPlan();
};

function updatePlanProgressBar() {
    const count = state.activePlanCompletedDays.length;
    const percent = Math.round((count / 7) * 100);
    document.getElementById("plan-progress-percent").textContent = percent;
    document.getElementById("plan-progress-bar").style.width = `${percent}%`;
}

// Goal tracker additions
function addGoal() {
    const reduction = parseFloat(document.getElementById("goal-target").value);
    const date = document.getElementById("goal-date").value;
    const targetVal = state.currentCalculation.total * (1 - reduction/100);

    const goal = {
        id: Date.now(),
        targetReduction: reduction,
        targetDate: date,
        initialValue: state.currentCalculation.total,
        targetValue: parseFloat(targetVal.toFixed(2)),
        isCompleted: false
    };

    state.goals.push(goal);
    saveStateToStorage();
    updateGoalsList();
    showToast("Reduction goal added successfully!");
    document.getElementById("goal-form").reset();
}

// Goals rendering
function updateGoalsList() {
    const container = document.getElementById("goals-list");
    if (!container) return;
    container.innerHTML = "";

    if (state.goals.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);">No active goals. Set one using the form on the left.</p>`;
        return;
    }

    state.goals.forEach(goal => {
        const current = state.currentCalculation.total;
        const totalToReduce = goal.initialValue - goal.targetValue;
        const reducedSoFar = goal.initialValue - current;
        let progress = totalToReduce > 0 ? Math.round((reducedSoFar / totalToReduce) * 100) : 0;
        progress = Math.max(0, Math.min(100, progress));

        if (current <= goal.targetValue && !goal.isCompleted) {
            goal.isCompleted = true;
            awardPoints(100, "for reaching your carbon footprint reduction goal!");
            saveStateToStorage();
        }

        const div = document.createElement("div");
        div.className = "goal-item";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-weight:600;">
                <span>Target: Reduce by ${goal.targetReduction}%</span>
                <span>Date: ${goal.targetDate}</span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-muted); margin:4px 0;">
                Goal target: ${goal.targetValue} Tons | Current footprint: ${current} Tons
            </div>
            <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width: ${progress}%;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-top:4px;">
                <span>Progress</span>
                <strong>${progress}% Completed</strong>
            </div>
            <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; width:fit-content; margin-top:8px;" onclick="deleteGoal(${goal.id})">
                <i class="fa-solid fa-trash"></i> Remove
            </button>
        `;
        container.appendChild(div);
    });
}

window.deleteGoal = function(id) {
    state.goals = state.goals.filter(g => g.id !== id);
    saveStateToStorage();
    updateGoalsList();
    showToast("Goal removed.");
};

// Challenges Gamification
function renderChallenges() {
    const container = document.getElementById("challenges-container");
    if (!container) return;
    container.innerHTML = "";

    const challenges = [
        { id: "car-free", title: "No Car Day", points: 150, desc: "Avoid personal car travel for one whole day.", icon: "fa-bicycle" },
        { id: "plastic-free", title: "Plastic Free Week", points: 200, desc: "Purchase no single-use plastics for 7 consecutive days.", icon: "fa-ban" },
        { id: "save-elec", title: "Save Electricity Challenge", points: 100, desc: "Reduce electricity bill by turning off secondary displays and cooling devices.", icon: "fa-plug" },
        { id: "plant-tree", title: "Plant a Tree Challenge", points: 250, desc: "Plant a seedling at your local garden or park.", icon: "fa-seedling" }
    ];

    challenges.forEach(challenge => {
        const isCompleted = state.challengesCompleted.includes(challenge.id);
        const div = document.createElement("div");
        div.className = `glass-card day-card ${isCompleted ? 'completed' : ''}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid ${challenge.icon}" style="color:var(--primary); font-size:1.2rem;"></i>
                    <strong style="font-family:var(--font-heading);">${challenge.title}</strong>
                </div>
                <span style="font-size:0.85rem; color:var(--primary); font-weight:700;">+${challenge.points} pts</span>
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-top:8px;">${challenge.desc}</p>
            <button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem; margin-top:8px; width:100%;" 
                onclick="completeChallenge('${challenge.id}', ${challenge.points})" ${isCompleted ? 'disabled' : ''}>
                <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-check'}"></i> ${isCompleted ? 'Completed' : 'Claim Points'}
            </button>
        `;
        container.appendChild(div);
    });

    updateBadges();
}

window.completeChallenge = function(id, points) {
    if (!state.challengesCompleted.includes(id)) {
        state.challengesCompleted.push(id);
        awardPoints(points, "for completing a sustainability challenge!");
        saveStateToStorage();
        renderChallenges();
    }
};

// Expanded Badges Trigger logic
function updateBadges() {
    // 1. Carbon Calculator Master (10+ calculations runs logged)
    const badgeCalcMaster = document.getElementById("badge-calc-master");
    if (badgeCalcMaster) {
        if (state.history.length >= 10) {
            badgeCalcMaster.classList.add("unlocked");
        } else {
            badgeCalcMaster.classList.remove("unlocked");
        }
    }

    // 2. Sustainability Explorer (Points > 500)
    const badgeExplorer = document.getElementById("badge-explorer");
    if (badgeExplorer) {
        if (state.points >= 500) {
            badgeExplorer.classList.add("unlocked");
        } else {
            badgeExplorer.classList.remove("unlocked");
        }
    }

    // 3. Eco Planner (Completed all 7 actions in current category action plan)
    const badgePlanner = document.getElementById("badge-planner");
    if (badgePlanner) {
        if (state.activePlanCompletedDays.length >= 7) {
            badgePlanner.classList.add("unlocked");
        } else {
            badgePlanner.classList.remove("unlocked");
        }
    }

    // 4. Challenge Champion (Completed all 4 challenges)
    const badgeChampion = document.getElementById("badge-champion");
    if (badgeChampion) {
        if (state.challengesCompleted.length >= 4) {
            badgeChampion.classList.add("unlocked");
        } else {
            badgeChampion.classList.remove("unlocked");
        }
    }

    // 5. Green Guardian (Grade A+ achieved)
    const badgeGuardian = document.getElementById("badge-guardian");
    if (badgeGuardian) {
        if (state.currentCalculation.grade === "A+") {
            badgeGuardian.classList.add("unlocked");
        } else {
            badgeGuardian.classList.remove("unlocked");
        }
    }
}

// History table rendering
function renderHistoryTable() {
    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (state.history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No carbon footprint history recorded yet.</td></tr>`;
        return;
    }

    const sortedHistory = [...state.history].reverse();
    sortedHistory.forEach(record => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${record.date}</td>
            <td style="font-weight:700;">${record.total} t</td>
            <td>${record.transport} t</td>
            <td>${record.energy} t</td>
            <td>${record.food} t</td>
            <td>${record.waste} t</td>
            <td><span class="impact-badge" style="background:var(--primary-light); color:var(--primary); font-weight:700; border-radius:4px; padding:2px 6px;">${record.grade}</span></td>
            <td>
                <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteHistoryRecord(${record.id})" aria-label="Delete history calculation record">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById("hist-count").textContent = state.history.length;
    
    const sum = state.history.reduce((a, b) => a + b.total, 0);
    const avg = state.history.length > 0 ? (sum / state.history.length).toFixed(2) : "0.00";
    document.getElementById("hist-average").textContent = `${avg} t`;

    const bestRecord = state.history.reduce((best, curr) => (curr.score > best ? curr.score : best), 0);
    document.getElementById("hist-best-score").textContent = bestRecord > 0 ? `${bestRecord}/100` : "N/A";
}

window.deleteHistoryRecord = function(id) {
    state.history = state.history.filter(r => r.id !== id);
    saveStateToStorage();
    renderHistoryTable();
    updateHistoryChart();
    showToast("History record deleted.");
};

// Historical Line Chart updates
function updateHistoryChart() {
    const ctx = document.getElementById("historyChart");
    if (!ctx) return;
    const context = ctx.getContext("2d");

    const dataPoints = [...state.history].sort((a, b) => a.id - b.id);
    const labels = dataPoints.map(p => p.date);
    const data = dataPoints.map(p => p.total);

    if (historyChart) {
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = data;
        historyChart.update();
    } else {
        historyChart = new Chart(context, {
            type: "line",
            data: {
                labels: labels.length > 0 ? labels : ["No Data"],
                datasets: [{
                    label: "Carbon Footprint (Tons CO2/yr)",
                    data: data.length > 0 ? data : [0],
                    borderColor: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: "#10b981"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: "#94a3b8"
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(148, 163, 184, 0.1)" },
                        ticks: { color: "#94a3b8" }
                    },
                    y: {
                        grid: { color: "rgba(148, 163, 184, 0.1)" },
                        ticks: { color: "#94a3b8" }
                    }
                }
            }
        });
    }
}
