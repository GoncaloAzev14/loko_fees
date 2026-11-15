# Documentation

Reference for how FC Lokomotiv's fines and box app is built and run. For the first-time setup, use the step-by-step guide in the [main README](../README.md#deploy-step-by-step).

| Read this | When you want to know |
| --- | --- |
| [Architecture](architecture.md) | How the pieces fit, the folder layout, the routes, how it is built and deployed |
| [Data model](data-model.md) | The tables, views and functions, who can read and write what, and the money rules |
| [Sign-in and admins](auth-and-admins.md) | How admins are invited, what "pending" means, first access with a code, the main admin |
| [Operations](operations.md) | Releasing a change, running migrations, deploying the function, Supabase settings, reading production |
| [Development](development.md) | Running it locally, the tests, how to change things safely |

## The project in one paragraph

A club tracks fines and a shared box. Anyone can look things up without logging in; admins log in to record fines, payments, income and expenses. It is one responsive React app, installable as a PWA, that talks directly to a Supabase project. The database holds every rule: payments settle a player's oldest fines first, late fees are added automatically after the due date, and a season can be closed to archive a summary and start again. Admins are added by invitation and only count once they have signed in.

## Words used in the app

| Term | Meaning |
| --- | --- |
| Caixa / box | Cash held by the club: payments plus income minus expenses |
| Multa | A fine. A *multa de falta de pagamento* is the automatic late fee |
| Época | The season, written like 2026/27 |
| Plantel | The roster of players and staff |
| Convite pendente | An admin invitation that has not been accepted yet |
| Primeiro acesso | The page where an invited person chooses a password with an emailed code |
