/**
 * SplitEase - Dining Bill Splitter
 * Pure Vanilla JavaScript (ES6+) - Zero External Dependencies
 */

(function () {
  'use strict';

  // Local Storage Key
  const STORAGE_KEY = 'splitease_bill_state_v1';

  // DOM Elements
  const billForm = document.getElementById('billForm');
  const occasionInput = document.getElementById('occasionInput');
  const billAmountInput = document.getElementById('billAmountInput');
  const peopleInput = document.getElementById('peopleInput');
  const splitBtn = document.getElementById('splitBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Stepper & Preset Elements
  const decPeopleBtn = document.getElementById('decPeopleBtn');
  const incPeopleBtn = document.getElementById('incPeopleBtn');
  const presetButtons = document.querySelectorAll('.preset-btn');
  const chipButtons = document.querySelectorAll('.chip-btn');

  // Error & Alert Elements
  const globalAlert = document.getElementById('globalAlert');
  const globalAlertText = document.getElementById('globalAlertText');
  const billErrorMsg = document.getElementById('billErrorMsg');
  const peopleErrorMsg = document.getElementById('peopleErrorMsg');

  // Result Section Elements
  const emptyState = document.getElementById('emptyState');
  const resultContent = document.getElementById('resultContent');
  const occasionDisplay = document.getElementById('occasionDisplay');
  const summaryBillDisplay = document.getElementById('summaryBillDisplay');
  const summaryPerPersonDisplay = document.getElementById('summaryPerPersonDisplay');
  const sharesList = document.getElementById('sharesList');
  const sharesCountBadge = document.getElementById('sharesCountBadge');
  const receiptSubtotal = document.getElementById('receiptSubtotal');
  const receiptTotal = document.getElementById('receiptTotal');
  const adjustmentNote = document.getElementById('adjustmentNote');
  const copyShareBtn = document.getElementById('copyShareBtn');
  const toastMsg = document.getElementById('toastMsg');
  const toastText = document.getElementById('toastText');

  /**
   * Currency Formatter for Indian Rupees
   * @param {number} amount
   * @returns {string} e.g. "₹1,000.00"
   */
  function formatINR(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0.00';
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Clear all displayed error messages and styles
   */
  function clearErrors() {
    globalAlert.classList.remove('visible');
    globalAlertText.textContent = '';

    billErrorMsg.classList.remove('visible');
    billErrorMsg.textContent = '';
    billAmountInput.classList.remove('input-error');

    peopleErrorMsg.classList.remove('visible');
    peopleErrorMsg.textContent = '';
    peopleInput.classList.remove('input-error');
  }

  /**
   * Show an error for a specific field or global alert
   */
  function showFieldError(field, message) {
    if (field === 'bill') {
      billAmountInput.classList.add('input-error');
      billErrorMsg.textContent = message;
      billErrorMsg.classList.add('visible');
      billAmountInput.focus();
    } else if (field === 'people') {
      peopleInput.classList.add('input-error');
      peopleErrorMsg.textContent = message;
      peopleErrorMsg.classList.add('visible');
      peopleInput.focus();
    }

    // Trigger subtle shake animation on the form card
    const card = document.getElementById('inputCard');
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth; // Force reflow
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 400);
    }
  }

  /**
   * Validate Input Values
   * @returns {{isValid: boolean, bill: number, people: number, occasion: string}}
   */
  function validateInputs() {
    clearErrors();

    const occasionRaw = occasionInput.value.trim();
    const occasion = occasionRaw || 'Dinner with Friends';

    const billRaw = billAmountInput.value.trim();
    const peopleRaw = peopleInput.value.trim();

    // 1. Bill Validation
    if (billRaw === '') {
      showFieldError('bill', 'Please enter the total bill amount.');
      return { isValid: false };
    }

    const billNumber = Number(billRaw);
    if (isNaN(billNumber)) {
      showFieldError('bill', 'Bill amount must be a valid number.');
      return { isValid: false };
    }

    if (billNumber <= 0) {
      showFieldError('bill', 'Bill amount must be greater than zero.');
      return { isValid: false };
    }

    const billDecimals = billRaw.split('.')[1];
    if (billDecimals && billDecimals.length > 2) {
      showFieldError('bill', 'Bill amount cannot have more than 2 decimal places (paise).');
      return { isValid: false };
    }

    if (billNumber > 10000000) {
      showFieldError('bill', 'Bill amount exceeds maximum limit (₹1 Crore).');
      return { isValid: false };
    }

    // 2. People Validation
    if (peopleRaw === '') {
      showFieldError('people', 'Please enter the number of people.');
      return { isValid: false };
    }

    // Check for decimal point or non-digits in people field
    if (peopleRaw.includes('.') || !/^\d+$/.test(peopleRaw)) {
      showFieldError('people', 'Number of people must be a positive whole number.');
      return { isValid: false };
    }

    const peopleNumber = parseInt(peopleRaw, 10);
    if (isNaN(peopleNumber) || peopleNumber <= 0) {
      showFieldError('people', 'Number of people must be at least 1.');
      return { isValid: false };
    }

    if (peopleNumber > 500) {
      showFieldError('people', 'Maximum 500 people supported per split.');
      return { isValid: false };
    }

    return {
      isValid: true,
      bill: billNumber,
      people: peopleNumber,
      occasion: occasion
    };
  }

  /**
   * Financially Accurate Paise/Cent Distribution Calculation
   * Guarantees that the sum of all individual shares matches the original bill exactly.
   *
   * @param {number} billAmount
   * @param {number} numPeople
   * @returns {Object}
   */
  function calculateAccurateShares(billAmount, numPeople) {
    // Convert to integer paise (cents) using Math.round to completely eliminate floating-point drift
    const totalPaise = Math.round(billAmount * 100);
    const basePaise = Math.floor(totalPaise / numPeople);
    const remainderPaise = totalPaise % numPeople;

    const shares = [];
    let runningSumPaise = 0;

    for (let i = 0; i < numPeople; i++) {
      // Distribute 1 extra paisa to the first `remainderPaise` people
      const personPaise = basePaise + (i < remainderPaise ? 1 : 0);
      runningSumPaise += personPaise;

      shares.push({
        personNumber: i + 1,
        paise: personPaise,
        amount: personPaise / 100,
        amountFormatted: formatINR(personPaise / 100),
        hasExtraPaisa: i < remainderPaise && remainderPaise > 0
      });
    }

    const totalFinal = runningSumPaise / 100;
    const baseShareAmount = basePaise / 100;

    return {
      totalAmount: totalFinal,
      totalFormatted: formatINR(totalFinal),
      baseShareFormatted: formatINR(baseShareAmount),
      remainderPaise: remainderPaise,
      numPeople: numPeople,
      shares: shares
    };
  }

  /**
   * Render Calculation Results to the Result Card
   */
  function renderResult(occasion, calculation) {
    // Update occasion and headers
    occasionDisplay.textContent = occasion;
    summaryBillDisplay.textContent = calculation.totalFormatted;

    // Summary per person
    if (calculation.remainderPaise === 0) {
      summaryPerPersonDisplay.textContent = calculation.baseShareFormatted;
    } else {
      summaryPerPersonDisplay.textContent = `~${calculation.baseShareFormatted}`;
    }

    sharesCountBadge.textContent = `${calculation.numPeople} ${calculation.numPeople === 1 ? 'Person' : 'People'}`;

    // Render individual shares list
    sharesList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    calculation.shares.forEach(function (share) {
      const row = document.createElement('div');
      row.className = 'person-row';

      // Avatar circle initials / number
      const avatar = document.createElement('div');
      avatar.className = 'avatar-circle';
      avatar.textContent = share.personNumber;

      const identityDiv = document.createElement('div');
      identityDiv.className = 'person-identity';

      const textWrap = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'person-name';
      name.textContent = `Person ${share.personNumber}`;

      textWrap.appendChild(name);

      if (share.hasExtraPaisa) {
        const note = document.createElement('div');
        note.className = 'person-note';
        note.textContent = '+1 paisa exact match adjustment';
        textWrap.appendChild(note);
      }

      identityDiv.appendChild(avatar);
      identityDiv.appendChild(textWrap);

      const amountDiv = document.createElement('div');
      amountDiv.className = 'person-amount';
      amountDiv.textContent = share.amountFormatted;

      row.appendChild(identityDiv);
      row.appendChild(amountDiv);
      fragment.appendChild(row);
    });

    sharesList.appendChild(fragment);

    // Update receipt breakdown
    receiptSubtotal.textContent = calculation.totalFormatted;
    receiptTotal.textContent = calculation.totalFormatted;

    // Show or hide remainder adjustment explanation
    if (calculation.remainderPaise > 0) {
      adjustmentNote.style.display = 'block';
      adjustmentNote.textContent = `Notice: An adjustment of ₹0.01 was distributed across ${calculation.remainderPaise} ${calculation.remainderPaise === 1 ? 'person' : 'people'} so the sum equals ${calculation.totalFormatted} to the exact paisa.`;
    } else {
      adjustmentNote.style.display = 'none';
      adjustmentNote.textContent = '';
    }

    // Toggle views
    emptyState.style.display = 'none';
    resultContent.classList.add('active');
  }

  /**
   * Save State to Local Storage
   */
  function saveState(occasion, bill, people, calculation) {
    try {
      const state = {
        occasion: occasion,
        bill: bill,
        people: people,
        calculation: calculation,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      // LocalStorage errors (quota, private mode) handled gracefully
      console.warn('SplitEase: Failed to save to localStorage', err);
    }
  }

  /**
   * Load and Restore State from Local Storage
   */
  function restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const state = JSON.parse(raw);
      if (
        !state ||
        typeof state !== 'object' ||
        typeof state.bill !== 'number' ||
        typeof state.people !== 'number' ||
        !state.calculation ||
        !Array.isArray(state.calculation.shares)
      ) {
        // Corrupted or outdated data; safely wipe
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      // Restore form fields
      occasionInput.value = state.occasion || '';
      billAmountInput.value = state.bill;
      peopleInput.value = state.people;

      // Update preset buttons active state
      updatePresetButtons(state.people);

      // Render the saved calculation
      renderResult(state.occasion || 'Dinner with Friends', state.calculation);
    } catch (err) {
      // Graceful fallback on corrupted JSON
      console.warn('SplitEase: Corrupted localStorage data cleared', err);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * Clear All & Reset
   */
  function handleReset() {
    clearErrors();

    // Reset inputs
    occasionInput.value = '';
    billAmountInput.value = '';
    peopleInput.value = '4'; // Friendly default

    // Reset presets
    updatePresetButtons(4);

    // Hide result, show empty state
    resultContent.classList.remove('active');
    emptyState.style.display = 'flex';
    sharesList.innerHTML = '';

    // Clear local storage
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }

    // Focus on bill input
    billAmountInput.focus();
    showToast('App reset to initial state.');
  }

  /**
   * Perform Bill Split Calculation
   */
  function handleSplit() {
    const validation = validateInputs();
    if (!validation.isValid) return;

    const calculation = calculateAccurateShares(validation.bill, validation.people);
    renderResult(validation.occasion, calculation);
    saveState(validation.occasion, validation.bill, validation.people, calculation);

    // Scroll slightly if on small mobile screen
    if (window.innerWidth <= 860) {
      resultContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Update Preset Buttons UI
   */
  function updatePresetButtons(num) {
    presetButtons.forEach(function (btn) {
      const val = parseInt(btn.getAttribute('data-people'), 10);
      if (val === num) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update stepper minus button state
    if (decPeopleBtn) {
      decPeopleBtn.disabled = num <= 1;
    }
  }

  /**
   * Show Toast Notification
   */
  let toastTimer = null;
  function showToast(message) {
    if (!toastMsg || !toastText) return;

    toastText.textContent = message;
    toastMsg.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastMsg.classList.remove('show');
    }, 2800);
  }

  /**
   * Copy Split Summary to Clipboard
   */
  function handleCopySummary() {
    const occasion = occasionDisplay.textContent || 'Dinner Bill';
    const total = receiptTotal.textContent || '';
    const peopleCount = sharesCountBadge.textContent || '';

    const rows = sharesList.querySelectorAll('.person-row');
    if (!rows.length) return;

    let text = `🍽️ ${occasion}\n`;
    text += `Total Bill: ${total} (${peopleCount})\n`;
    text += `------------------------------------\n`;

    rows.forEach(function (row) {
      const name = row.querySelector('.person-name')?.textContent || '';
      const amount = row.querySelector('.person-amount')?.textContent || '';
      text += `${name}: ${amount}\n`;
    });

    text += `------------------------------------\n`;
    text += `Final Total: ${total}\n`;
    text += `Split precisely with SplitEase!`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          showToast('Breakdown copied! Ready to paste into group chat.');
        },
        function () {
          fallbackCopyText(text);
        }
      );
    } else {
      fallbackCopyText(text);
    }
  }

  /**
   * Fallback Clipboard Copy using textarea
   */
  function fallbackCopyText(text) {
    try {
      const tempArea = document.createElement('textarea');
      tempArea.value = text;
      tempArea.style.position = 'fixed';
      tempArea.style.left = '-9999px';
      document.body.appendChild(tempArea);
      tempArea.focus();
      tempArea.select();
      document.execCommand('copy');
      document.body.removeChild(tempArea);
      showToast('Breakdown copied to clipboard!');
    } catch (e) {
      showToast('Unable to auto-copy. Please share manually.');
    }
  }

  // -------------------------------------------------------------------------
  // Event Listeners
  // -------------------------------------------------------------------------

  // Form Submit
  if (billForm) {
    billForm.addEventListener('submit', function (e) {
      e.preventDefault();
      handleSplit();
    });
  }

  // Split Button Click
  if (splitBtn) {
    splitBtn.addEventListener('click', function (e) {
      e.preventDefault();
      handleSplit();
    });
  }

  // Reset Button Click
  if (resetBtn) {
    resetBtn.addEventListener('click', function (e) {
      e.preventDefault();
      handleReset();
    });
  }

  // Stepper Decrement
  if (decPeopleBtn) {
    decPeopleBtn.addEventListener('click', function () {
      let current = parseInt(peopleInput.value, 10);
      if (isNaN(current) || current <= 1) current = 2;
      const next = Math.max(1, current - 1);
      peopleInput.value = next;
      updatePresetButtons(next);
      clearErrors();
    });
  }

  // Stepper Increment
  if (incPeopleBtn) {
    incPeopleBtn.addEventListener('click', function () {
      let current = parseInt(peopleInput.value, 10);
      if (isNaN(current) || current < 1) current = 1;
      const next = Math.min(500, current + 1);
      peopleInput.value = next;
      updatePresetButtons(next);
      clearErrors();
    });
  }

  // People Input Direct Change
  if (peopleInput) {
    peopleInput.addEventListener('input', function () {
      const val = parseInt(peopleInput.value, 10);
      if (!isNaN(val)) {
        updatePresetButtons(val);
      }
      clearErrors();
    });
  }

  // Bill Input Change
  if (billAmountInput) {
    billAmountInput.addEventListener('input', function () {
      clearErrors();
    });
  }

  // Quick Preset Buttons for People
  presetButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const val = parseInt(btn.getAttribute('data-people'), 10);
      if (!isNaN(val)) {
        peopleInput.value = val;
        updatePresetButtons(val);
        clearErrors();
      }
    });
  });

  // Quick Occasion Chips
  chipButtons.forEach(function (chip) {
    chip.addEventListener('click', function () {
      const title = chip.getAttribute('data-occasion');
      if (title) {
        occasionInput.value = title;
        clearErrors();
      }
    });
  });

  // Copy Summary Action
  if (copyShareBtn) {
    copyShareBtn.addEventListener('click', handleCopySummary);
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function () {
    restoreState();
    const curVal = parseInt(peopleInput.value, 10);
    if (!isNaN(curVal)) {
      updatePresetButtons(curVal);
    }
  });

})();
