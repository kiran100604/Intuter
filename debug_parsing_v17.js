const lines = [
    "#### 🔑 Key Definition: The Standard Inner Product (Dot Product in $\\mathbb{R}^n$)",
    "#### 🔑 Key Definition: Inner Product Space",
    "#### ⚠️ Common Pitfall: Non-Standard Inner Products",
    "> **🔑 Key Definition: Old Style**",
    "  ⚠️ **Common Pitfall: Indented**"
];

function testRegex(line) {
    // Regex to handle:
    // 1. Indentation (^\s*)
    // 2. Headers (#+\s*)
    // 3. Blockquotes (>\s*)
    // 4. Emojis ([^\w\s\*]+\s*)
    // 5. Optional Bold (** ... **)
    // 6. Type (Key Definition, etc)
    // 7. Colon (:)

    const regex = /^\s*(?:#+\s*)?(?:>\s*)?(?:[^\w\s\*]+\s*)*(?:\*\*)?([^\*:]+)(?:\*\*)?[:]/;

    const match = line.match(regex);
    console.log(`Line: "${line}"`);
    console.log(`  Match: ${!!match}`);
    if (match) {
        console.log(`  Captured Type: "${match[1]}"`);
    }
}

lines.forEach(testRegex);
