<?php

declare(strict_types=1);

use App\Api\Request;
use App\Api\Routes;
use App\Container;
use App\Database\Connection;

require dirname(__DIR__) . '/bootstrap.php';

Routes::build(new Container(Connection::open()))
    ->dispatch(Request::fromGlobals())
    ->send();
