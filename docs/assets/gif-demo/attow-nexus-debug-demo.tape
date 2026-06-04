Output docs/assets/attow-nexus-debug-demo.gif

Set Theme "Catppuccin Mocha"
Set FontSize 28
Set Width 1280
Set Height 720
Set Padding 24
Set Margin 12
Set TypingSpeed 35ms

Type "export PATH=/vhs/docs/assets/gif-demo/bin:$PATH"
Enter
Sleep 350ms
Ctrl+L
Sleep 250ms

Type "python run_agent.py"
Enter
Sleep 2700ms

Ctrl+L
Sleep 250ms

Type "nexus log --run broken-agent-demo"
Enter
Sleep 3000ms

Ctrl+L
Sleep 250ms

Type "nexus diff a109d84 f829a1b"
Enter
Sleep 2800ms

Ctrl+L
Sleep 250ms

Type "nexus replay a109d84"
Enter
Sleep 3200ms

Ctrl+L
Sleep 250ms

Type "nexus about"
Enter
Sleep 2200ms
