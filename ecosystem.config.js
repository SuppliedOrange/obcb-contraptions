module.exports = {
    apps : [
        {
            name   : "display",
            script : "npx tsx run_websocket.ts",
        },
        {
            name   : "pong",
            script : "npx tsx run_pong_websocket.ts"
        },
        {
            name   : "clock",
            script : "npx tsx run_clock_websocket.ts",
            cron_restart: "*/10 * * * *"
        },
        {
            name   : "tictactoe",
            script : "npx tsx run_tic_tac_toe_websocket.ts",
        },

    ]
  }
  