<?php

/**
 * @license
 *
 * sabre/katana.
 * Copyright (C) 2015 fruux GmbH (https://fruux.com/)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

namespace Sabre\Katana\Dav\Authentication;

use Sabre\Katana\Database;
use Sabre\Katana\DavAcl\User\Plugin as User;
use Sabre\DAV\Auth\Backend;
use Sabre\DAV\Server;
use Sabre\HTTP\RequestInterface as Request;
use Sabre\HTTP\ResponseInterface as Response;

/**
 * Basic authentication.
 *
 * @copyright Copyright (C) 2015 fruux GmbH (https://fruux.com/).
 * @author Ivan Enderlin
 * @license GNU Affero General Public License, Version 3.
 */
class BasicBackend extends Backend\AbstractBasic {

    /**
     * Database.
     *
     * @var Database
     */
    protected $database   = null;

    /**
     * Constructor.
     *
     * @param  Database  $database    Database.
     * @return void
     */
    function __construct(Database $database) {

        $this->database = $database;
    }

    /**
     * Validate the username and password.
     * We use a timing attack resistant approach.
     *
     * @param  string  $username    Username.
     * @param  string  $password    Password.
     * @return boolean
     */
    protected function validateUserPass($username, $password) {

        $database  = $this->database;
        $statement = $database->prepare(
            'SELECT digesta1 FROM users WHERE username = :username'
        );
        $statement->execute(['username' => $username]);

        $digest = $statement->fetch($database::FETCH_COLUMN, 0);

        return User::checkPassword($password, $digest);
    }

    /**
     * Override the parent `challenge` method to remove the `WWW-Authenticate`
     * header in the response if the `X-Requested-With` header is present in the
     * request. This last trick prevents the browser to prompt of dialog to the
     * user.
     *
     * @param  Request   $request     Request.
     * @param  Response  $response    Response.
     * @return void
     */
    function challenge(Request $request, Response $response) {
        parent::challenge($request, $response);

        if ('XMLHttpRequest' === $request->getHeader('X-Requested-With')) {
            $response->removeHeader('WWW-Authenticate');
        }
    }
}
