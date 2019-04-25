<?php

/**
 * @license
 *
 * sabre/katana.
 * Copyright (C) 2016 fruux GmbH (https://fruux.com/)
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

namespace Sabre\Katana\Test\Unit\Server;

use Sabre\Katana\Test\Unit\Suite;
use Mock;

/**
 * Test suite of the server.
 *
 * @copyright Copyright (C) fruux GmbH (https://fruux.com/)
 * @author Ivan Enderlin
 * @license GNU Affero General Public License, Version 3.
 */
class Server extends Suite {

    /**
     * @tags server authentication
     */
    function case_unauthorized() {

        $this
            ->given($server = new Mock\Server())
            ->when($server->run())
            ->then
                ->integer($server->response->getStatus())
                    ->isEqualTo(401);
    }

    /**
     * @tags server authentication
     */
    function case_authorized() {

        $this
            ->given(
                $server = new Mock\Server(),
                $server->request->addHeader(
                    'Authorization',
                    'Basic ' .
                    base64_encode(
                        $server::ADMINISTRATOR_LOGIN .
                        ':' .
                        $server::ADMINISTRATOR_PASSWORD
                    )
                )
            )
            ->when($server->run())
            ->then
                ->integer($server->response->getStatus())
                    ->isNotEqualTo(401);
    }
}
