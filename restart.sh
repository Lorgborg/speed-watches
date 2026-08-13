#!/bin/sh

# Define sessions and commands using case
for sess in speed-watches-api worker1 worker2 checker; do
    # Determine command
    case "$sess" in
        speed-watches-api) cmd="npm run api" ;;
        worker1|worker2)   cmd="npm run worker" ;;
	checker)	   cmd="npm run checker";;
        *) echo "Unknown session: $sess"; continue ;;
    esac

    # Kill existing session
    if tmux has-session -t "$sess" 2>/dev/null; then
        tmux kill-session -t "$sess"
        echo "Killed existing session: $sess"
    fi

    # Start new session
    tmux new -d -s "$sess" "$cmd"
    echo "Started session: $sess"
done
