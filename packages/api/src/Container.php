<?php

declare(strict_types=1);

namespace App;

use App\Database\Seeder;
use App\Repository\BalanceRepository;
use App\Repository\ExpenseRepository;
use App\Repository\PersonRepository;
use App\Repository\SessionRepository;
use App\Repository\TripRepository;
use App\Repository\UserRepository;
use App\Service\AuthService;
use App\Service\CategoryGuesser;
use App\Service\DebtService;
use App\Service\ExpenseService;
use App\Service\ExpenseValidator;
use App\Service\SettlementService;
use App\Service\SummaryService;
use App\Service\TripAccess;
use App\Service\TripService;
use App\Service\TripStatusService;
use PDO;

/** Composition root: wires repositories and services around one PDO connection. */
final class Container
{
    public readonly TripRepository $trips;
    public readonly PersonRepository $people;
    public readonly ExpenseRepository $expenseRepository;
    public readonly BalanceRepository $balances;
    public readonly UserRepository $users;
    public readonly AuthService $auth;
    public readonly TripAccess $access;
    public readonly TripService $tripService;
    public readonly TripStatusService $tripStatus;
    public readonly ExpenseService $expenses;
    public readonly SummaryService $summaries;
    public readonly DebtService $debts;

    public function __construct(public readonly PDO $pdo)
    {
        $this->trips = new TripRepository($pdo);
        $this->people = new PersonRepository($pdo);
        $this->expenseRepository = new ExpenseRepository($pdo);
        $this->balances = new BalanceRepository($pdo);
        $this->users = new UserRepository($pdo);
        $this->auth = new AuthService($pdo, $this->users, new SessionRepository($pdo), $this->people);
        $this->access = new TripAccess($this->trips);
        $this->tripService = new TripService($pdo, $this->trips, $this->people, $this->users);
        $this->tripStatus = new TripStatusService($this->trips);
        $this->expenses = new ExpenseService($pdo, $this->trips, $this->expenseRepository, new ExpenseValidator(), new CategoryGuesser());
        $this->summaries = new SummaryService($this->trips, $this->balances, new SettlementService());
        $this->debts = new DebtService($this->trips, $this->summaries);
    }

    public function seeder(): Seeder
    {
        return new Seeder($this->pdo, $this->trips, $this->people, $this->users, $this->expenses);
    }
}
