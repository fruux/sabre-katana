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

namespace Sabre\Katana\DavAcl\User;

use Sabre\Katana\Database;
use Sabre\DAV as SabreDav;
use Sabre\HTTP\RequestInterface as Request;
use Sabre\HTTP\ResponseInterface as Response;

/**
 * The user plugin is responsible to keep the user database up-to-date.
 *
 * @copyright Copyright (C) 2015 fruux GmbH (https://fruux.com/).
 * @author Ivan Enderlin
 * @license GNU Affero General Public License, Version 3.
 */
class Plugin extends SabreDav\ServerPlugin
{
    /**
     * DAV server.
     *
     * @var DAV\Server;
     */
    protected $_server   = null;

    /**
     * Database.
     *
     * @var Database
     */
    protected $_database = null;

    /**
     * Constructor.
     *
     * @param  Database  $database    Database.
     * @return void
     */
    public function __construct(Database $database)
    {
        $this->_database = $database;

        return;
    }

    /**
     * Returns a plugin name.
     *
     * Using this name other plugins will be able to access other plugins
     * using \Sabre\DAV\Server::getPlugin
     *
     * @return string
     */
    public function getPluginName()
    {
        return 'user';
    }

    /**
     * Returns a bunch of meta-data about the plugin.
     *
     * Providing this information is optional, and is mainly displayed by the
     * Browser plugin.
     *
     * The description key in the returned array may contain html and will not
     * be sanitized.
     *
     * @return array
     */
    public function getPluginInfo()
    {
        return [
            'name'        => $this->getPluginName(),
            'description' => 'User support.',
            'link'        => 'http://sabre.io/katana/'
        ];
    }

    /**
     * This initializes the plugin.
     *
     * This function is called by Sabre\DAV\Server, after
     * addPlugin is called.
     *
     * This method should set up the required event subscriptions.
     *
     * @param  SabreDav\Server $server    Server.
     * @return void
     */
    public function initialize(SabreDav\Server $server)
    {
        $this->_server = $server;

        $this->_server->on('afterUnbind', [$this, 'afterUnbind']);
        $this->_server->on('propPatch',   [$this, 'propPatch']);

        return;
    }

    /**
     * Triggered by a `DELETE`, `COPY` or `MOVE`. The goal is to remove the user
     * from the database.
     *
     * @param  string  $path    Path.
     * @return boolean
     */
    public function afterUnbind($path)
    {
        $username  = substr($path, strlen('principals/'));
        $database  = $this->_database;
        $statement = $database->prepare(
            'DELETE FROM users WHERE username = :username'
        );

        return $statement->execute(['username' => $username]);
    }

    /**
     * Triggered by a `PROPPATCH` or a `MKCOL`. The goal is to respectively
     * update or create the user in the database.
     *
     * @param  string              $path         Path.
     * @param  SabreDav\PropPatch  $propPatch    The `PROPPATCH` object.
     * @return void
     */
    public function propPatch($path, SabreDav\PropPatch $propPatch)
    {
        $username = substr($path, strlen('principals/'));
        $database = $this->_database;

        $propPatch->handle(
            [
                '{http://sabredav.org/ns}password'
            ],
            function ($properties) use ($username, $database) {
                $statement = $database->prepare(
                    'REPLACE INTO users (username, digesta1) ' .
                    'VALUES (:username, :digest)'
                );

                $password = Plugin::hashPassword(
                    $properties['{http://sabredav.org/ns}password']
                );

                return $statement->execute([
                    'username' => $username,
                    'digest'   => $password
                ]);
            }
        );

        return;
    }

    /**
     * Hash a password.
     *
     * @param  string  $password    Password.
     * @return string
     */
    public static function hashPassword($password)
    {
        return password_hash(
            $password,
            PASSWORD_DEFAULT,
            [
                'cost' => 10
            ]
        );
    }

    /**
     * Check a password matches a hash.
     *
     * @param  string  $password    Password not hashed.
     * @param  string  $hash        Password hashed.
     * @return boolean
     */
    public static function checkPassword($password, $hash)
    {
        return password_verify($password, $hash);
    }
}
