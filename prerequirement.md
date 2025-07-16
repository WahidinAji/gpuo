# What is GPUO?

GPUO is a _git push -u origin <branch>_. It is a tool to help me to push the code to the remote repository.

# Why is it needed?

I have been working on a project for a long time. Shortly, I've been working on a repository that has a lot of branches and I must cherry-pick each pieces of code to a new branch before opening a pull request to the `Master` or `main` branch. I've been doing this manually for a long time and it's tiring. So, I decided to create a tool to help me to do this because I'm tired of doing this manually. Imagine that I've to do `git cherry-pick XYZ` and `git push -u origin <branch>`. I want to automate this process. So I created this tool.

# Tech-Stack

* Typescript
* React
* tanstack/react-query
* Bun
* Tailwind
* Shadcn
* SQLite

# Backend

* Use Bun as http server
* Use SQLite as database

# Frontend

* Use React as UI
* Use Tanstack/react-query as state management
* Use Tailwind as CSS
* Use Shadcn as UI components

# prerequisite

## install bun as a package manager
## install React, Tanstack/react-query, Tailwind, Shadcn and SQLite


# Features

## Home Page
- Displays a list of tasks
- Go through the tasks

## Task Page
- Displays the task details


