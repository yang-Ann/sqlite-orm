import type { CurOrmStoreType, CurOperType, MyObject, OrderByType, WhereConnectType, WhereType, DataType, TableFieldsOption, SqliteOrmRsultType, BuildUpdateByWhenOption } from "./types";
/**
 * SQLite ORM
 */
declare class SqliteOrm {
    #private;
    opt: {
        /** 表名称 */
        tableName: string;
        /** 是否开启值填充模式 */
        isFillValue: boolean;
    };
    constructor(opt: {
        /** 表名称 */
        tableName: string;
        /** 是否开启值填充模式 */
        isFillValue: boolean;
    });
    private curOrmStore;
    /** 获取默认的ORM方法 */
    private getDefaultCurOrmStore;
    /** 表名 */
    get $tableName(): string;
    /** 是否值填充模式 */
    get $isFillValue(): boolean;
    /** 修改表名称(会影响后续所有的sql语句生成) */
    setTableName(tableName: string): this;
    /** 修改值填充模式(会影响后续所有的sql语句生成) */
    setFillValue(flag: boolean): this;
    /** 清除ORM状态 */
    private clearCurOrmStore;
    /** 设置操作状态 */
    setOperStore<T extends CurOperType>(key: T, value: CurOrmStoreType[T]): this;
    /** 设置表名称(影响单次的sql语句生成) */
    tableName(tableName: string): this;
    /** 设置值填充模式(影响单次的sql语句生成) */
    fillValue(flag?: boolean): this;
    /**
     * 生成 INSERT 语句
     * @param data 插入的数据
     * @returns `string`
     */
    inser<T extends MyObject>(data: T): SqliteOrmRsultType;
    /**
     * 批量生成 INSERT 语句
     * @param datas 插入的数据
     * @param maxSize 因为 sqlite 存在限制, 一次sql最多只能插入999个变量的值, 这里参数进行控制
     * @returns `string[]`
     */
    insers<T extends MyObject[]>(datas: T, maxSize?: number): SqliteOrmRsultType[];
    /** DELETE 操作 */
    delete(): this;
    /** UPDATE 操作 */
    update<T extends MyObject>(obj: T): this;
    /** SELECT 操作 */
    select(field?: string): this;
    /** COUNT 查询 */
    count(field: string): this;
    /** 设置 GROUP BY */
    groupBy(field: string): this;
    /** 设置 ORDER BY */
    orderBy(order: OrderByType, field: string): this;
    private buildWhereItem;
    /** 设置 WHERE */
    where(key: string, connect: WhereConnectType, value: any): this;
    /** 设置 AND 和 OR */
    private setWhere;
    /** 设置 AND */
    and(key: string, connect: WhereConnectType, value: any): this;
    /** 设置 OR */
    or(key: string, connect: WhereConnectType, value: any): this;
    /** 获取 WHERE 普通的连接符 */
    private getConnectItem;
    private buildWhereArrayItem;
    /** 批量设置 WHERE */
    whereArray(key: string, connect: WhereConnectType, value: any[], whereType: WhereType): this;
    /** 批量设置 WHERE OR */
    orArray(key: string, connect: WhereConnectType, value: any[]): this;
    /** 批量设置 WHERE AND */
    andArray(key: string, connect: WhereConnectType, value: any[]): this;
    /** 设置 LIMIT */
    limit(limit: number, offset?: number): this;
    /**
     * 获取原始sql语句
     *
     * 返回值是一个数组 @return `[string, any[]]`
     * - 索引为0是一个 sql 语句, 当开启了`isFillValue`里的值是使用`?`代替
     * - 索引为1是一个数组, 当开启了`isFillValue`的时候就是对应的值
     */
    getSqlRaw(): SqliteOrmRsultType;
    /** 生成 WHERE */
    private buildWhere;
    /** 生成 GROUP BY */
    private buildGroupBy;
    /** 生成 ORDER BY */
    private buildOrderBy;
    /** 生成 LIMIT */
    private buildLimit;
    /** 生成 INSERT VLAUES */
    private buildInsertValues;
    /** 简单的克隆数据 */
    cloneData(data: any): any;
    /** 生成 sql */
    buildRawSql(): SqliteOrmRsultType;
    /** 获取其他的sql */
    getOtherSql(): string;
    /**
     * 新增列
     * @param field 字段名
     * @param type 类型
     * @param tableName 表名
     * @returns `string`
     */
    addColumn(field: string, type: DataType, tableName?: string): SqliteOrmRsultType;
    /**
     * 数据切片
     */
    dataSlice<T = any>(opt: {
        /** 需要切片数据 */
        datas: T[];
        /** 一份的最大长度 */
        onceMaxDataLength: number;
    }): T[][];
    /**
     * 执行 update when 语句(支持大数据量, 内部会做切分执行), 参考`$buildUpdateByWhen`
     */
    buildUpdateByWhen<T = any>(opt: BuildUpdateByWhenOption<T>): SqliteOrmRsultType[];
    /**
     * 执行 update when 语句, 这个方法最多一次只能更新999条数据
     * - 不然会报错 `sqlite3_prepare_v2 failure: Expression tree is too large (maximum depth 1000)`
     * - 请使用`updateByWhen`
     *
     * ```ts
     * const updateByWhenRes = await this.$buildUpdateByWhen({
     * 	datas: data,
     * 	fieldOpts: [
     * 		{
     * 			setField: "tidCode",
     * 			getWhenField() {
     * 				return "epcNum";
     * 			},
     * 			getWhenValue(row) {
     * 				return row.epc;
     * 			},
     * 			getThenValue(row) {
     * 				return row.tid;
     * 			}
     * 		},
     * 		{
     * 			setField: "scanDate",
     * 			getWhenField() {
     * 				return "epcNum";
     * 			},
     * 			getWhenValue(row) {
     * 				return row.epc;
     * 			},
     * 			getThenValue(row) {
     * 				return row.scanTime;
     * 			}
     * 		}
     * 	],
     * 	getExtraUpdateWhen: (updatas) => {
     * 		// const epcs = updatas.map(e => `"${e.epc}"`).join(", ");
     * 		// return `flag = CASE epcNum IN (${epcs}) THEN 2 END`;
     * 		return "flag = CASE WHEN 1=1 THEN 2 END";
     * 	},
     * 	getExtraWhere: (updatas) => {
     * 		// const epcs = updatas.map(e => `"${e.epc}"`).join(", ");
     * 		// return `epcNum IN (${epcs})`;
     *
     * 		return updatas.map((e) => `epcNum="${e.epc}"`).join(" OR ");
     * 	}
     * });
     * ```
     *
     * 内部生成并执行的 sql 参考如下:
     *
     * ```sql
     * UPDATE "xxx.db"
     *  SET tidCode = CASE
     *    WHEN epcNum="4400899522000294" THEN "E28011052000719490DF0AC0"
     *    WHEN epcNum="44008995HD006822" THEN "E280110520007B5A91060AC0"
     *    WHEN epcNum="44008995HD006875" THEN "E28011052000725A910B0AC0"
     *  END,
     *    scanDate = CASE
     *     WHEN epcNum="4400899522000294" THEN "2023-08-15 10:58:32"
     *     WHEN epcNum="44008995HD006822" THEN "2023-08-15 10:57:11"
     *     WHEN epcNum="44008995HD006875" THEN "2023-08-15 10:56:39"
     *  END,
     *    flag = CASE WHEN 1=1 THEN 2
     *  END
     *   WHERE epcNum="4400899522000294" OR epcNum="44008995HD006822" OR epcNum="44008995HD006875"
     * ```
     */
    private $buildUpdateByWhen;
    /**
     * 获取数据库表信息
     */
    tableInfo(tableName?: string): SqliteOrmRsultType;
    /** 根据 id 查询指定数据 */
    findById(id: string | number, field?: string): SqliteOrmRsultType;
    /** 查询所有的数据 */
    selectAll(tableName?: string): SqliteOrmRsultType;
    /** 根据 id 删除指定的数据 */
    deleteById(id: string | number, field?: string): SqliteOrmRsultType;
    /** 删除所有的数据 */
    deleteAll(tableName?: string): SqliteOrmRsultType;
    /** 删除表 */
    deleteTable(tableName?: string): SqliteOrmRsultType;
    /**
     * 构建 CREATE TABLE 语句
     */
    buildCreate(option: TableFieldsOption[], tableName?: string): SqliteOrmRsultType;
}
export default SqliteOrm;
