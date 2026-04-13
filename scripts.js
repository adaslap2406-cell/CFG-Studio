class CFGSimplifier {
    constructor() {
        this.grammar = new Map();
        this.startSymbol = null;
        this.nonTerminals = new Set();
        this.terminals = new Set();
        this.history = [];
        
        this.init();
    }

    init() {
        this.textarea = document.getElementById('grammar-input');
        this.simplifyBtn = document.getElementById('simplify-btn');
        this.loadExampleBtn = document.getElementById('load-example');
        this.stepsContainer = document.getElementById('steps-container');
        this.historyList = document.getElementById('history-list');
        
        this.simplifyBtn.addEventListener('click', () => this.simplify());
        this.loadExampleBtn.addEventListener('click', () => this.loadExample());
        this.textarea.addEventListener('input', () => this.updateStats());
        
        this.loadHistory();
    }

    loadExample() {
        this.textarea.value = `S → AB | aB | Aa
A → aA | a | ε
B → bB | b
C → cC | c
D → dD`;
        this.updateStats();
    }

    updateStats() {
        const input = this.textarea.value.trim();
        if (!input) {
            document.getElementById('nonterminal-count').textContent = '—';
            document.getElementById('production-count').textContent = '—';
            document.getElementById('start-symbol').textContent = '—';
            document.getElementById('has-epsilon').textContent = '—';
            return;
        }

        try {
            this.parseGrammar(input);
            document.getElementById('nonterminal-count').textContent = this.nonTerminals.size;
            document.getElementById('production-count').textContent = 
                Array.from(this.grammar.values()).reduce((sum, prods) => sum + prods.length, 0);
            document.getElementById('start-symbol').textContent = this.startSymbol || '—';
            
            const hasEpsilon = Array.from(this.grammar.values())
                .some(prods => prods.some(p => p === 'ε' || p === 'epsilon' || p === ''));
            document.getElementById('has-epsilon').textContent = hasEpsilon ? 'Yes' : 'No';
        } catch (e) {
            document.getElementById('nonterminal-count').textContent = '?';
            document.getElementById('production-count').textContent = '?';
            document.getElementById('start-symbol').textContent = '?';
            document.getElementById('has-epsilon').textContent = '?';
        }
    }

    parseGrammar(input) {
        this.grammar = new Map();
        this.nonTerminals = new Set();
        this.terminals = new Set();
        this.startSymbol = null;

        const lines = input.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            // Support multiple arrow formats
            const match = line.match(/^\s*([A-Z])\s*(?:→|->|:)\s*(.+)$/);
            if (!match) continue;

            const [, lhs, rhsStr] = match;
            
            if (!this.startSymbol) {
                this.startSymbol = lhs;
            }
            
            this.nonTerminals.add(lhs);
            
            const alternatives = rhsStr.split('|').map(s => s.trim());
            
            if (!this.grammar.has(lhs)) {
                this.grammar.set(lhs, []);
            }
            
            for (const alt of alternatives) {
                const normalized = alt === 'ε' || alt === 'epsilon' || alt === '' ? 'ε' : alt;
                this.grammar.get(lhs).push(normalized);
                
                // Extract terminals
                for (const char of normalized) {
                    if (char >= 'a' && char <= 'z') {
                        this.terminals.add(char);
                    }
                }
            }
        }

        return this.grammar;
    }

    simplify() {
        const input = this.textarea.value.trim();
        if (!input) return;

        try {
            this.parseGrammar(input);
        } catch (e) {
            this.showError('Failed to parse grammar. Please check the syntax.');
            return;
        }

        if (this.grammar.size === 0) {
            this.showError('No valid productions found.');
            return;
        }

        this.stepsContainer.innerHTML = '';
        const steps = [];

        // Step 0: Initial Grammar
        steps.push(this.createStepCard(0, 'Initial Grammar', this.describeGrammar(this.grammar)));

        // Step 1: Find and remove non-generating symbols
        const generating = this.findGeneratingSymbols();
        const nonGenerating = new Set([...this.nonTerminals].filter(x => !generating.has(x)));
        
        let grammarAfterGenerating = this.removeNonGenerating(generating);
        steps.push(this.createStepCard(1, 'Remove Non-Generating Symbols', 
            this.describeGenerating(generating, nonGenerating, grammarAfterGenerating)));

        // Step 2: Find and remove unreachable symbols
        const reachable = this.findReachableSymbols(grammarAfterGenerating);
        const unreachable = new Set([...grammarAfterGenerating.keys()].filter(x => !reachable.has(x)));
        
        let grammarAfterReachable = this.removeUnreachable(grammarAfterGenerating, reachable);
        steps.push(this.createStepCard(2, 'Remove Unreachable Symbols',
            this.describeReachable(reachable, unreachable, grammarAfterReachable)));

        // Step 3: Find nullable symbols and eliminate ε-productions
        const nullable = this.findNullableSymbols(grammarAfterReachable);
        let grammarAfterNullable = this.eliminateEpsilonProductions(grammarAfterReachable, nullable);
        steps.push(this.createStepCard(3, 'Eliminate ε-Productions',
            this.describeNullable(nullable, grammarAfterNullable)));

        // Step 4: Find and eliminate unit productions
        const unitPairs = this.findUnitPairs(grammarAfterNullable);
        let grammarFinal = this.eliminateUnitProductions(grammarAfterNullable, unitPairs);
        steps.push(this.createStepCard(4, 'Eliminate Unit Productions',
            this.describeUnitPairs(unitPairs, grammarFinal)));

        // Step 5: Final simplified grammar
        steps.push(this.createFinalCard(grammarFinal));

        // Render all steps with animation
        steps.forEach((step, i) => {
            setTimeout(() => {
                this.stepsContainer.appendChild(step);
                step.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, i * 200);
        });

        // Save to history
        this.saveToHistory(input, grammarFinal);
    }

    findGeneratingSymbols() {
        const generating = new Set(this.terminals);
        let changed = true;

        while (changed) {
            changed = false;
            for (const [lhs, productions] of this.grammar) {
                if (generating.has(lhs)) continue;

                for (const prod of productions) {
                    if (prod === 'ε' || this.allSymbolsIn(prod, generating)) {
                        generating.add(lhs);
                        changed = true;
                        break;
                    }
                }
            }
        }

        return generating;
    }

    allSymbolsIn(production, symbolSet) {
        for (const char of production) {
            if (char >= 'A' && char <= 'Z') {
                if (!symbolSet.has(char)) return false;
            }
        }
        return true;
    }

    removeNonGenerating(generating) {
        const newGrammar = new Map();

        for (const [lhs, productions] of this.grammar) {
            if (!generating.has(lhs)) continue;

            const validProductions = productions.filter(prod => {
                if (prod === 'ε') return true;
                return this.allSymbolsIn(prod, generating);
            });

            if (validProductions.length > 0) {
                newGrammar.set(lhs, validProductions);
            }
        }

        return newGrammar;
    }

    findReachableSymbols(grammar) {
        const reachable = new Set();
        const queue = [this.startSymbol];
        reachable.add(this.startSymbol);

        while (queue.length > 0) {
            const current = queue.shift();
            const productions = grammar.get(current) || [];

            for (const prod of productions) {
                for (const char of prod) {
                    if (char >= 'A' && char <= 'Z' && !reachable.has(char)) {
                        reachable.add(char);
                        queue.push(char);
                    }
                }
            }
        }

        return reachable;
    }

    removeUnreachable(grammar, reachable) {
        const newGrammar = new Map();

        for (const [lhs, productions] of grammar) {
            if (reachable.has(lhs)) {
                newGrammar.set(lhs, [...productions]);
            }
        }

        return newGrammar;
    }

    findNullableSymbols(grammar) {
        const nullable = new Set();
        let changed = true;

        // First pass: direct ε productions
        for (const [lhs, productions] of grammar) {
            if (productions.includes('ε')) {
                nullable.add(lhs);
            }
        }

        // Fixed-point iteration
        while (changed) {
            changed = false;
            for (const [lhs, productions] of grammar) {
                if (nullable.has(lhs)) continue;

                for (const prod of productions) {
                    if (this.isNullable(prod, nullable)) {
                        nullable.add(lhs);
                        changed = true;
                        break;
                    }
                }
            }
        }

        return nullable;
    }

    isNullable(production, nullable) {
        if (production === 'ε') return true;
        for (const char of production) {
            if (char >= 'a' && char <= 'z') return false;
            if (char >= 'A' && char <= 'Z' && !nullable.has(char)) return false;
        }
        return true;
    }

    eliminateEpsilonProductions(grammar, nullable) {
        const newGrammar = new Map();

        for (const [lhs, productions] of grammar) {
            const newProductions = new Set();

            for (const prod of productions) {
                if (prod === 'ε') continue;

                // Generate all combinations
                const combinations = this.generateNullableCombinations(prod, nullable);
                for (const comb of combinations) {
                    if (comb !== '') {
                        newProductions.add(comb);
                    }
                }
            }

            // If start symbol was nullable, add ε back
            if (lhs === this.startSymbol && nullable.has(lhs)) {
                newProductions.add('ε');
            }

            if (newProductions.size > 0) {
                newGrammar.set(lhs, [...newProductions]);
            }
        }

        return newGrammar;
    }

    generateNullableCombinations(production, nullable) {
        const results = [''];

        for (const char of production) {
            const newResults = [];
            for (const result of results) {
                newResults.push(result + char);
                if (char >= 'A' && char <= 'Z' && nullable.has(char)) {
                    newResults.push(result);
                }
            }
            results.length = 0;
            results.push(...newResults);
        }

        return [...new Set(results)];
    }

    findUnitPairs(grammar) {
        const unitPairs = new Map();

        // Initialize with reflexive pairs
        for (const nt of grammar.keys()) {
            unitPairs.set(nt, new Set([nt]));
        }

        // Fixed-point iteration
        let changed = true;
        while (changed) {
            changed = false;
            for (const [lhs, productions] of grammar) {
                for (const prod of productions) {
                    if (prod.length === 1 && prod >= 'A' && prod <= 'Z') {
                        const reachable = unitPairs.get(prod);
                        if (reachable) {
                            for (const nt of reachable) {
                                if (!unitPairs.get(lhs).has(nt)) {
                                    unitPairs.get(lhs).add(nt);
                                    changed = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        return unitPairs;
    }

    eliminateUnitProductions(grammar, unitPairs) {
        const newGrammar = new Map();

        for (const [lhs, reachable] of unitPairs) {
            const newProductions = new Set();

            for (const nt of reachable) {
                const productions = grammar.get(nt) || [];
                for (const prod of productions) {
                    // Don't add unit productions
                    if (!(prod.length === 1 && prod >= 'A' && prod <= 'Z')) {
                        newProductions.add(prod);
                    }
                }
            }

            if (newProductions.size > 0) {
                newGrammar.set(lhs, [...newProductions]);
            }
        }

        return newGrammar;
    }

    describeGrammar(grammar) {
        const div = document.createElement('div');
        div.innerHTML = `<p>Starting with ${grammar.size} non-terminal(s) and ${
            Array.from(grammar.values()).reduce((sum, p) => sum + p.length, 0)
        } production(s).</p>`;
        div.appendChild(this.renderGrammar(grammar));
        return div;
    }

    describeGenerating(generating, nonGenerating, grammar) {
        const div = document.createElement('div');
        
        div.innerHTML = `<p>A symbol is <strong>generating</strong> if it can derive a string of terminals.</p>`;
        
        if (nonGenerating.size > 0) {
            div.innerHTML += `<p>Non-generating symbols found:</p>`;
            const tagList = document.createElement('div');
            tagList.className = 'symbol-list';
            for (const sym of nonGenerating) {
                const tag = document.createElement('span');
                tag.className = 'symbol-tag removed';
                tag.textContent = sym;
                tagList.appendChild(tag);
            }
            div.appendChild(tagList);
        } else {
            div.innerHTML += `<p>All symbols are generating. No removal needed.</p>`;
        }

        const genList = document.createElement('div');
        genList.className = 'symbol-list';
        for (const sym of generating) {
            if (sym >= 'A' && sym <= 'Z') {
                const tag = document.createElement('span');
                tag.className = 'symbol-tag generating';
                tag.textContent = sym;
                genList.appendChild(tag);
            }
        }
        div.appendChild(genList);
        
        div.appendChild(this.renderGrammar(grammar));
        return div;
    }

    describeReachable(reachable, unreachable, grammar) {
        const div = document.createElement('div');
        
        div.innerHTML = `<p>A symbol is <strong>reachable</strong> if it can be derived from the start symbol ${this.startSymbol}.</p>`;
        
        if (unreachable.size > 0) {
            div.innerHTML += `<p>Unreachable symbols found:</p>`;
            const tagList = document.createElement('div');
            tagList.className = 'symbol-list';
            for (const sym of unreachable) {
                const tag = document.createElement('span');
                tag.className = 'symbol-tag removed';
                tag.textContent = sym;
                tagList.appendChild(tag);
            }
            div.appendChild(tagList);
        } else {
            div.innerHTML += `<p>All symbols are reachable. No removal needed.</p>`;
        }
        
        div.appendChild(this.renderGrammar(grammar));
        return div;
    }

    describeNullable(nullable, grammar) {
        const div = document.createElement('div');
        
        div.innerHTML = `<p>A symbol is <strong>nullable</strong> if it can derive ε (empty string).</p>`;
        
        if (nullable.size > 0) {
            div.innerHTML += `<p>Nullable symbols:</p>`;
            const tagList = document.createElement('div');
            tagList.className = 'symbol-list';
            for (const sym of nullable) {
                const tag = document.createElement('span');
                tag.className = 'symbol-tag nullable';
                tag.textContent = sym;
                tagList.appendChild(tag);
            }
            div.appendChild(tagList);
            div.innerHTML += `<p>For each production containing nullable symbols, we add versions with those symbols removed.</p>`;
        } else {
            div.innerHTML += `<p>No nullable symbols found. No ε-production elimination needed.</p>`;
        }
        
        div.appendChild(this.renderGrammar(grammar));
        return div;
    }

    describeUnitPairs(unitPairs, grammar) {
        const div = document.createElement('div');
        
        div.innerHTML = `<p>A <strong>unit production</strong> has the form A → B (single non-terminal on right side).</p>`;
        
        const significantPairs = [];
        for (const [lhs, reachable] of unitPairs) {
            for (const rhs of reachable) {
                if (lhs !== rhs) {
                    significantPairs.push(`(${lhs}, ${rhs})`);
                }
            }
        }

        if (significantPairs.length > 0) {
            div.innerHTML += `<p>Unit pairs (A ⇒* B): ${significantPairs.join(', ')}</p>`;
            div.innerHTML += `<p>For each pair (A, B), we add to A all non-unit productions of B.</p>`;
        } else {
            div.innerHTML += `<p>No unit productions found. No elimination needed.</p>`;
        }
        
        div.appendChild(this.renderGrammar(grammar));
        return div;
    }

    renderGrammar(grammar) {
        const container = document.createElement('div');
        container.className = 'grammar-display';

        for (const [lhs, productions] of grammar) {
            const line = document.createElement('div');
            line.className = 'production';
            line.innerHTML = `<span class="nonterminal">${lhs}</span><span class="arrow">→</span>${
                productions.map(p => this.formatProduction(p)).join(' <span class="arrow">|</span> ')
            }`;
            container.appendChild(line);
        }

        return container;
    }

    formatProduction(prod) {
        if (prod === 'ε') return '<span class="terminal">ε</span>';
        
        let html = '';
        for (const char of prod) {
            if (char >= 'A' && char <= 'Z') {
                html += `<span class="nonterminal">${char}</span>`;
            } else {
                html += `<span class="terminal">${char}</span>`;
            }
        }
        return html;
    }

    createStepCard(number, title, content) {
        const card = document.createElement('div');
        card.className = 'step-card';
        
        const header = document.createElement('div');
        header.className = 'step-header';
        header.innerHTML = `
            <span class="step-number">${number}</span>
            <span class="step-title">${title}</span>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'step-content';
        if (typeof content === 'string') {
            contentDiv.innerHTML = content;
        } else {
            contentDiv.appendChild(content);
        }
        
        card.appendChild(header);
        card.appendChild(contentDiv);
        
        return card;
    }

    createFinalCard(grammar) {
        const card = document.createElement('div');
        card.className = 'step-card final-grammar';
        
        const header = document.createElement('div');
        header.className = 'step-header';
        header.innerHTML = `
            <span class="step-number">✓</span>
            <span class="step-title">Simplified Grammar</span>
        `;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'step-content';
        
        const prodCount = Array.from(grammar.values()).reduce((sum, p) => sum + p.length, 0);
        contentDiv.innerHTML = `<p>Final grammar has <strong>${grammar.size}</strong> non-terminal(s) and <strong>${prodCount}</strong> production(s).</p>`;
        contentDiv.appendChild(this.renderGrammar(grammar));
        
        card.appendChild(header);
        card.appendChild(contentDiv);
        
        return card;
    }

    showError(message) {
        this.stepsContainer.innerHTML = `
            <div class="step-card" style="border-color: var(--error);">
                <div class="step-header">
                    <span class="step-number" style="background: var(--error);">!</span>
                    <span class="step-title">Error</span>
                </div>
                <div class="step-content">
                    <p>${message}</p>
                </div>
            </div>
        `;
    }

    saveToHistory(input, result) {
        const entry = {
            input: input.substring(0, 50) + (input.length > 50 ? '...' : ''),
            fullInput: input,
            timestamp: new Date().toISOString()
        };

        this.history.unshift(entry);
        if (this.history.length > 10) this.history.pop();

        localStorage.setItem('cfg-history', JSON.stringify(this.history));
        this.renderHistory();
    }

    loadHistory() {
        try {
            this.history = JSON.parse(localStorage.getItem('cfg-history')) || [];
            this.renderHistory();
        } catch (e) {
            this.history = [];
        }
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<p class="empty-state">No grammars simplified yet</p>';
            return;
        }

        this.historyList.innerHTML = '';
        for (const entry of this.history) {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.textContent = entry.input;
            item.addEventListener('click', () => {
                this.textarea.value = entry.fullInput;
                this.updateStats();
            });
            this.historyList.appendChild(item);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new CFGSimplifier();
});
