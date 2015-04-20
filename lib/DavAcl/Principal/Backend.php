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

namespace Sabre\Katana\DavAcl\Principal;

use Sabre\Katana\Server\Server;
use Sabre\DAVACL as SabreDavAcl;
use Sabre\DAV as SabreDav;

/**
 * Principal backend implementation.
 *
 * @copyright Copyright (C) 2015 fruux GmbH (https://fruux.com/).
 * @author Ivan Enderlin
 * @license GNU Affero General Public License, Version 3.
 */
class Backend extends SabreDavAcl\PrincipalBackend\PDO
{
    /**
     * Delete the current node.
     *
     * @return void
     */
    public function deletePrincipal($path)
    {
        $administratorPrincipal = 'principals/' . Server::ADMINISTRATOR_LOGIN;

        if ($path === $administratorPrincipal) {
            throw new SabreDav\Exception\Forbidden(
                sprintf(
                    'Deleting the first administrator %s is forbidden.',
                    $administratorPrincipal
                )
            );
        }

        $statement = $this->pdo->prepare(
            'DELETE FROM ' . $this->tableName . ' WHERE uri = :uri'
        );

        return $statement->execute(['uri' => $path]);
    }
}
